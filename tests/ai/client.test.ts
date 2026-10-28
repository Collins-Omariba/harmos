import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import test from "node:test";
import { z } from "zod";

import {
  runTask,
  taskCacheKey,
} from "@/lib/ai/client";

const inputSchema = z.object({ q: z.string() });
const outputSchema = z.object({ answer: z.number() });
const PROMPT = 'Return exactly {"answer": 42}.';

function completionBody(content: string, usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }) {
  return JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
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
