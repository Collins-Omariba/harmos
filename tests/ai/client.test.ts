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
    OPENAI_API_KEY: "your_key_here",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    await assert.rejects(
      runTask("probe_task", inputSchema, outputSchema, PROMPT),
      /OPENAI_API_KEY is not configured/,
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
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: `http://127.0.0.1:${port}`,
    HARMOS_AI_MODEL: "test-model",
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

test("runTask rejects non-JSON model output loudly", async () => {
  const cacheDir = `/tmp/opencode/harmos-client-garbage-${process.pid}`;
  const { server, port } = await startFakeOpenAI(() => completionBody("hello there"));
  const previous = setEnv({
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: `http://127.0.0.1:${port}`,
    HARMOS_AI_MODEL: "test-model",
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
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: `http://127.0.0.1:${port}`,
    HARMOS_AI_MODEL: "test-model",
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
