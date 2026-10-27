import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";
import { z } from "zod";

/**
 * The AI boundary for Harmos.
 *
 * Rules (see README):
 * - Components never import this file. Only named tasks in lib/ai/tasks/*.ts
 *   may call runTask().
 * - Every task is structured-output, cached on disk, and logged.
 * - This file is the only place that may reference the OpenAI SDK. The
 *   signature is OpenAI-compatible and provider-agnostic: swap
 *   OPENAI_BASE_URL and HARMOS_AI_MODEL to move providers.
 *
 * v0 intentionally makes no network request. runTask() returns a valid disk
 * cache hit when one exists (used by HARMOS_DEMO_MODE=1) and otherwise throws
 * "not_implemented".
 */

export const DEFAULT_OPENAI_BASE_URL = "https://api.meta.ai/v1";
export const DEFAULT_AI_MODEL = "muse-spark-1.3";

export type AiTaskStatus =
  | "cache_hit"
  | "not_implemented"
  | "demo_cache_miss"
  | "error";

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiLogEntry = {
  ts: string;
  task: string;
  model: string;
  baseUrl: string;
  cacheKey: string;
  cacheHit: boolean;
  tokens: AiUsage;
  latencyMs: number;
  status: AiTaskStatus;
  error?: string;
};

export type AiConfig = {
  baseUrl: string;
  model: string;
  cacheDir: string;
  demoMode: boolean;
  apiKeyConfigured: boolean;
};

export function getAiConfig(): AiConfig {
  return {
    baseUrl: process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
    model: process.env.HARMOS_AI_MODEL ?? DEFAULT_AI_MODEL,
    cacheDir: process.env.HARMOS_CACHE_DIR ?? "./.cache",
    demoMode: process.env.HARMOS_DEMO_MODE === "1",
    apiKeyConfigured: Boolean(
      process.env.OPENAI_API_KEY &&
        process.env.OPENAI_API_KEY !== "your_key_here",
    ),
  };
}

/**
 * @internal Reserved for the future live implementation inside this file.
 * Named AI tasks must call runTask(), never the SDK directly.
 */
export function createOpenAIClient(): OpenAI {
  const { baseUrl } = getAiConfig();

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "not_configured",
    baseURL: baseUrl,
  });
}

function schemaFingerprint(schema: z.ZodType): string {
  try {
    return JSON.stringify(z.toJSONSchema(schema));
  } catch {
    return "unserializable-schema";
  }
}

/**
 * `<task>/<hash>.json`, where the hash covers the task name, the prompt, and
 * the input schema shape. Changing any of those invalidates the cache.
 */
export function taskCacheKey(
  taskName: string,
  prompt: string,
  inputSchema: z.ZodType,
): string {
  return createHash("sha256")
    .update(
      [taskName, prompt, schemaFingerprint(inputSchema)].join("\n---\n"),
    )
    .digest("hex");
}

function safeTaskName(taskName: string): string {
  return taskName.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function taskCachePath(taskName: string, cacheKey: string): string {
  const { cacheDir } = getAiConfig();

  return path.resolve(
    process.cwd(),
    cacheDir,
    "ai",
    safeTaskName(taskName),
    `${cacheKey}.json`,
  );
}

export type CachedTask<T> = {
  task: string;
  key: string;
  model: string;
  createdAt: string;
  usage: AiUsage;
  data: T;
};

export async function readTaskCache<T>(
  taskName: string,
  cacheKey: string,
  outputSchema: z.ZodType<T>,
): Promise<T | null> {
  const file = taskCachePath(taskName, cacheKey);

  try {
    const raw = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const candidate =
      parsed &&
      typeof parsed === "object" &&
      "task" in parsed &&
      "data" in parsed
        ? (parsed as CachedTask<unknown>).data
        : parsed;

    const result = outputSchema.safeParse(candidate);
    return result.success ? result.data : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    return null;
  }
}

export async function writeTaskCache<T>(
  taskName: string,
  cacheKey: string,
  data: T,
  usage: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
): Promise<string> {
  const file = taskCachePath(taskName, cacheKey);
  const payload: CachedTask<T> = {
    task: taskName,
    key: cacheKey,
    model: getAiConfig().model,
    createdAt: new Date().toISOString(),
    usage,
    data,
  };

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return file;
}

export async function appendAiLog(entry: AiLogEntry): Promise<void> {
  const logFile = path.resolve(process.cwd(), "logs", "ai.log");

  await mkdir(path.dirname(logFile), { recursive: true });
  await appendFile(logFile, `${JSON.stringify(entry)}\n`, "utf8");
}

/**
 * The one and only AI entry point.
 *
 * Signature is fixed for v0:
 *   runTask<T>(taskName, inputSchema, outputSchema, prompt)
 *
 * Future implementations must:
 * 1. compute the cache key from taskName + prompt + inputSchema,
 * 2. return a valid disk cache hit before doing any work,
 * 3. request JSON validated by outputSchema,
 * 4. write the cache and append one JSON line to logs/ai.log.
 */
export async function runTask<T>(
  taskName: string,
  inputSchema: z.ZodType,
  outputSchema: z.ZodType<T>,
  prompt: string,
): Promise<T> {
  const startedAt = Date.now();
  const config = getAiConfig();
  const cacheKey = taskCacheKey(taskName, prompt, inputSchema);
  const logBase = {
    ts: new Date().toISOString(),
    task: taskName,
    model: config.model,
    baseUrl: config.baseUrl,
    cacheKey,
    tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    latencyMs: 0,
  } satisfies Omit<AiLogEntry, "cacheHit" | "latencyMs" | "status"> & {
    latencyMs: number;
  };

  const cached = await readTaskCache(taskName, cacheKey, outputSchema);
  if (cached !== null) {
    await appendAiLog({
      ...logBase,
      cacheHit: true,
      latencyMs: Date.now() - startedAt,
      status: "cache_hit",
    });
    return cached;
  }

  if (config.demoMode) {
    const error = `demo_mode_cache_miss:${taskName}`;
    await appendAiLog({
      ...logBase,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      status: "demo_cache_miss",
      error,
    });
    throw new Error(error);
  }

  await appendAiLog({
    ...logBase,
    cacheHit: false,
    latencyMs: Date.now() - startedAt,
    status: "not_implemented",
    error: "not_implemented",
  });

  throw new Error("not_implemented");
}
