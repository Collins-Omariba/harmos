import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import test from "node:test";
import { z } from "zod";

import {
  AiOutputError,
  runTask,
  runTextTask,
  taskCacheKey,
} from "@/lib/ai/client";

const inputSchema = z.object({ q: z.string() });
const outputSchema = z.object({ answer: z.number() });
const PROMPT = 'Return exactly {"answer": 42}.';

function completionBody(
  content: string,
  usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  finishReason = "stop",
) {
  return JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: finishReason,
      },
    ],
    usage,
  });
}

function startFakeOpenAI(respond: () => string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(respond());
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve({ server, port: address.port });
    });
  });
}

function setEnv(vars: Record<string, string | undefined>) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return previous;
}

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function logEntry(cacheKey: string) {
  const log = await readFile(path.resolve(process.cwd(), "logs", "ai.log"), "utf8");
  return log
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((line) => line.cacheKey === cacheKey)
    .at(-1);
}

test("runTask throws a helpful error without a configured key", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-nokey-${process.pid}`;
  const previous = setEnv({
    AI_API_KEY: "your_key_here",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    await assert.rejects(
      runTask("probe_task", inputSchema, outputSchema, PROMPT),
      /AI_API_KEY is not configured/,
    );

    const key = taskCacheKey("probe_task", PROMPT, inputSchema);
    const entry = await logEntry(key);
    assert.equal(entry?.status, "error");
  } finally {
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTask calls the model, validates, caches, and logs real tokens", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-live-${process.pid}`;
  const { server, port } = await startFakeOpenAI(() =>
    completionBody(JSON.stringify({ answer: 42 })),
  );
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    const first = await runTask("live_task", inputSchema, outputSchema, PROMPT);
    assert.deepEqual(first, { answer: 42 });

    const key = taskCacheKey("live_task", PROMPT, inputSchema);
    const okEntry = await logEntry(key);
    assert.equal(okEntry?.status, "ok");
    assert.equal(okEntry?.cacheHit, false);
    assert.deepEqual((okEntry?.tokens as object) ?? {}, {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });

    // Second call must come from disk: kill the server first.
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const second = await runTask("live_task", inputSchema, outputSchema, PROMPT);
    assert.deepEqual(second, { answer: 42 });

    const hitEntry = await logEntry(key);
    assert.equal(hitEntry?.status, "cache_hit");
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTask retries once on invalid JSON, then succeeds", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-retry-${process.pid}`;
  let calls = 0;
  const { server, port } = await startFakeOpenAI(() => {
    calls += 1;
    return calls === 1
      ? completionBody("this is not json")
      : completionBody(JSON.stringify({ answer: 7 }));
  });
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    const result = await runTask("retry_task", inputSchema, outputSchema, PROMPT);
    assert.deepEqual(result, { answer: 7 });
    assert.equal(calls, 2);

    const key = taskCacheKey("retry_task", PROMPT, inputSchema);
    const entry = await logEntry(key);
    assert.equal(entry?.status, "ok");
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});
test("runTask rejects non-JSON model output loudly", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-garbage-${process.pid}`;
  const { server, port } = await startFakeOpenAI(() => completionBody("hello there"));
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    await assert.rejects(
      runTask("garbage_task", inputSchema, outputSchema, PROMPT),
      /ai_invalid_json/,
    );

    const key = taskCacheKey("garbage_task", PROMPT, inputSchema);
    const entry = await logEntry(key);
    assert.equal(entry?.status, "error");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("failed model output carries the raw text for manual transcription", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-raw-${process.pid}`;
  const { server, port } = await startFakeOpenAI(() =>
    completionBody("TPS7A02 is a great LDO, trust me"),
  );
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    await assert.rejects(
      runTask("raw_task", inputSchema, outputSchema, PROMPT),
      (error: unknown) => {
        assert.ok(error instanceof AiOutputError);
        assert.match(error.message, /ai_invalid_json/);
        assert.match(error.message, /TPS7A02 is a great LDO/);
        assert.equal(error.raw, "TPS7A02 is a great LDO, trust me");
        return true;
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("HARMOS_AI_DEBUG=1 dumps the prompt and raw reply to logs/ai-debug", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-debug-${process.pid}`;
  const debugDir = path.resolve(process.cwd(), "logs", "ai-debug");
  const { server, port } = await startFakeOpenAI(() =>
    completionBody(JSON.stringify({ answer: 42 })),
  );
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
    HARMOS_AI_DEBUG: "1",
  });

  let before = new Set<string>();
  try {
    const { readdir } = await import("node:fs/promises");
    before = new Set(await readdir(debugDir));
  } catch {
    before = new Set<string>();
  }

  try {
    const result = await runTask("debug_task", inputSchema, outputSchema, PROMPT);
    assert.deepEqual(result, { answer: 42 });

    const { readdir, readFile: readDump, unlink } = await import("node:fs/promises");
    const after = await readdir(debugDir);
    const created = after.filter((f) => !before.has(f) && f.startsWith("debug_task-"));
    assert.ok(created.length >= 1, "a debug dump file was written");
    const dump = JSON.parse(
      await readDump(path.resolve(debugDir, created[0] as string), "utf8"),
    ) as Record<string, unknown>;
    assert.match(String(dump.prompt ?? ""), /Return exactly/);
    assert.match(String(dump.rawReply ?? ""), /"answer":\s*42/);
    for (const file of created) {
      await unlink(path.resolve(debugDir, file));
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTask rejects schema-violating model output loudly", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-shape-${process.pid}`;
  const { server, port } = await startFakeOpenAI(() =>
    completionBody(JSON.stringify({ wrong: true })),
  );
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    await assert.rejects(
      runTask("shape_task", inputSchema, outputSchema, PROMPT),
      /ai_invalid_output/,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTask sends web_search_options when asked", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-search-${process.pid}`;
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      bodies.push(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(completionBody(JSON.stringify({ answer: 1 })));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${address.port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    const result = await runTask(
      "search_task",
      inputSchema,
      outputSchema,
      PROMPT,
      { webSearch: true },
    );
    assert.deepEqual(result, { answer: 1 });
    assert.equal(bodies.length, 1);
    const sent = JSON.parse(bodies[0] ?? "{}") as Record<string, unknown>;
    assert.deepEqual(sent.web_search_options, { search_context_size: "medium" });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTask falls back without search when the endpoint rejects it", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-nosearch-${process.pid}`;
  const bodies: string[] = [];
  let calls = 0;
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      calls += 1;
      bodies.push(raw);
      if (raw.includes("web_search_options")) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: "Unknown field: web_search_options",
              type: "invalid_request_error",
            },
          }),
        );
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(completionBody(JSON.stringify({ answer: 2 })));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${address.port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    const result = await runTask(
      "nosearch_task",
      inputSchema,
      outputSchema,
      PROMPT,
      { webSearch: true },
    );
    assert.deepEqual(result, { answer: 2 });
    assert.equal(calls, 2);
    assert.ok((bodies[0] ?? "").includes("web_search_options"));
    assert.ok(!(bodies[1] ?? "").includes("web_search_options"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTextTask makes one bare call and returns raw prose", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-text-${process.pid}`;
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      bodies.push(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(completionBody("TPS7A02 — a fine LDO."));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${address.port}`,
    AI_MODEL: "test-model",
    // A stale low budget in .env must not starve text calls (see the
    // 4k/8k empty-reply dumps); the text floor is 16000.
    AI_MAX_TOKENS: "4000",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    const first = await runTextTask("text_task", PROMPT);
    assert.equal(first, "TPS7A02 — a fine LDO.");
    assert.equal(bodies.length, 1, "exactly one model call");
    const sent = JSON.parse(bodies[0] ?? "{}") as Record<string, unknown>;
    assert.equal(sent.max_tokens, 16000);
    assert.ok(!("web_search_options" in sent), "no search options");
    assert.ok(!("response_format" in sent), "no response format");

    const second = await runTextTask("text_task", PROMPT);
    assert.equal(second, first, "second call hits the text cache");
    assert.equal(bodies.length, 1, "no extra network on cache hit");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTextTask streams text and provider reasoning deltas as they arrive", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-stream-${process.pid}`;
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      bodies.push(raw);
      res.writeHead(200, { "content-type": "text/event-stream" });
      const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
        `data: ${JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion.chunk",
          created: 0,
          model: "test-model",
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`;
      res.end(
        chunk({ role: "assistant", reasoning_content: "Checking LDOs. " }) +
          chunk({ reasoning_content: "TPS7A02 fits." }) +
          chunk({ content: "TPS7A02 — " }) +
          chunk({ content: "a fine LDO." }, ) +
          chunk({}, "stop") +
          "data: [DONE]\n\n",
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${address.port}`,
    AI_MODEL: "test-model",
    AI_MAX_TOKENS: undefined,
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    const deltas: { text: string; reasoning: string }[] = [];
    const result = await runTextTask("stream_task", PROMPT, {
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });
    assert.equal(result, "TPS7A02 — a fine LDO.");
    assert.equal(bodies.length, 1, "one streamed call");
    assert.equal(
      (JSON.parse(bodies[0] ?? "{}") as { stream?: boolean }).stream,
      true,
    );
    assert.equal(
      deltas.map((delta) => delta.reasoning).join(""),
      "Checking LDOs. TPS7A02 fits.",
      "provider reasoning is forwarded live",
    );
    assert.equal(
      deltas.map((delta) => delta.text).join(""),
      "TPS7A02 — a fine LDO.",
    );

    const cachedDeltas: string[] = [];
    const cached = await runTextTask("stream_task", PROMPT, {
      onDelta: (delta) => {
        cachedDeltas.push(delta.text);
      },
    });
    assert.equal(cached, result);
    assert.deepEqual(cachedDeltas, [result], "cache hit emits the full text once");
    assert.equal(bodies.length, 1, "no extra network on cache hit");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("runTextTask fails on an empty reply in one call, with no retry ladder", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-silent-${process.pid}`;
  const budgets: number[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      const parsed = JSON.parse(raw) as { max_tokens?: number };
      budgets.push(parsed.max_tokens ?? 0);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(completionBody("", undefined, "length"));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${address.port}`,
    AI_MODEL: "test-model",
    AI_MAX_TOKENS: undefined,
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    await assert.rejects(runTextTask("silent_task", PROMPT), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ai_empty_reply/);
      assert.match(error.message, /finish_reason=length/);
      assert.match(error.message, /AI_MAX_TOKENS/);
      return true;
    });
    assert.deepEqual(budgets, [16000], "one call at the full budget, no doubling");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("the no-search fallback appends the suffix and notifies the caller", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-suffix-${process.pid}`;
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      bodies.push(raw);
      if (raw.includes("web_search_options")) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: "Unknown field: web_search_options",
              type: "invalid_request_error",
            },
          }),
        );
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(completionBody(JSON.stringify({ answer: 3 })));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${address.port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    let notified = false;
    const result = await runTask(
      "suffix_task",
      inputSchema,
      outputSchema,
      PROMPT,
      {
        webSearch: true,
        noSearchPromptSuffix: " [NO-SEARCH-MODE]",
        onSearchUnsupported: () => {
          notified = true;
        },
      },
    );
    assert.deepEqual(result, { answer: 3 });
    assert.equal(notified, true, "caller learns the fallback fired");
    assert.ok(!(bodies[1] ?? "").includes("web_search_options"));
    assert.ok(
      (bodies[1] ?? "").includes("[NO-SEARCH-MODE]"),
      "retry carries the suffix",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreEnv(previous);
    await rm(cacheDir, { recursive: true, force: true });
  }
});
