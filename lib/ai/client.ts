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
 *   AI_BASE_URL and AI_MODEL to move providers.
 *
 * runTask() behavior:
 * 1. Return a valid disk-cache hit before doing any work.
 * 2. In demo mode (HARMOS_DEMO_MODE=1) a miss throws instead of calling the
 *    network, so the demo cannot silently go live.
 * 3. Without a configured AI_API_KEY a miss throws with setup help.
 * 4. Otherwise it makes one OpenAI-compatible JSON call, validates the
 *    response against the output schema, writes the cache, and logs the
 *    call with real token counts.
 */

export const DEFAULT_AI_BASE_URL = "https://api.meta.ai/v1";
export const DEFAULT_AI_MODEL = "muse-spark-1.3";

export type AiTaskStatus =
  | "cache_hit"
  | "ok"
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
    baseUrl: process.env.AI_BASE_URL ?? DEFAULT_AI_BASE_URL,
    model: process.env.AI_MODEL ?? DEFAULT_AI_MODEL,
    cacheDir: process.env.HARMOS_CACHE_DIR ?? "./.cache",
    demoMode: process.env.HARMOS_DEMO_MODE === "1",
    apiKeyConfigured: Boolean(
      process.env.AI_API_KEY &&
        process.env.AI_API_KEY !== "your_key_here",
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
    apiKey: process.env.AI_API_KEY ?? "not_configured",
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
 * Live-call tuning. Low temperature keeps extraction-style tasks
 * deterministic; the cache (not sampling) is what guarantees repeat runs.
 */
export const LIVE_TEMPERATURE = 0.2;
export const LIVE_MAX_TOKENS = 4000;
export const LIVE_TIMEOUT_MS = 90_000;

function buildSystemPrompt(outputSchema: z.ZodType, webSearch = false): string {
  let shape = "";
  try {
    shape = `\nIt must validate against this JSON schema:\n${JSON.stringify(z.toJSONSchema(outputSchema))}`;
  } catch {
    shape = "";
  }

  return [
    "You are a JSON-only assistant for a hardware engineering workspace.",
    "Respond with a single JSON object and nothing else: no markdown fences, no commentary.",
    "Never invent specifications, part numbers, URLs, or ids that are not in the user message.",
    ...(webSearch
      ? [
          "You may browse the live web to verify facts before answering; prefer manufacturer datasheets and product pages over memory.",
        ]
      : []),
    shape,
  ].join("\n");
}

/**
 * The one and only AI entry point.
 *
 * Signature: runTask<T>(taskName, inputSchema, outputSchema, prompt, opts?)
 *
 * Behavior:
 * 1. compute the cache key from taskName + prompt + inputSchema,
 * 2. return a valid disk cache hit before doing any work,
 * 3. request JSON validated by outputSchema (single attempt, plus one repair
 *    retry on invalid output, plus one no-search retry if the endpoint
 *    rejects web-search options),
 * 4. write the cache and append one JSON line to logs/ai.log.
 *
 * Pass { webSearch: true } when the task benefits from live browsing. The
 * model searches server-side; nothing is fetched client-side and no search
 * API key exists anywhere in this codebase.
 */
export type RunTaskOpts = {
  /** Ask the model to browse the web while answering (server-side search). */
  webSearch?: boolean;
};

export async function runTask<T>(
  taskName: string,
  inputSchema: z.ZodType,
  outputSchema: z.ZodType<T>,
  prompt: string,
  opts?: RunTaskOpts,
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

  if (!config.apiKeyConfigured) {
    const error = "ai_key_not_configured";
    await appendAiLog({
      ...logBase,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      status: "error",
      error,
    });
    throw new Error(
      "AI_API_KEY is not configured. Put a real provider key in .env (it must not be the your_key_here placeholder) to enable live AI tasks.",
    );
  }

  return runLive(taskName, inputSchema, outputSchema, prompt, logBase, {
    webSearch: opts?.webSearch ?? false,
    startedAt,
  });
}

type LogBase = Omit<AiLogEntry, "cacheHit" | "latencyMs" | "status"> & {
  latencyMs: number;
};

async function runLive<T>(
  taskName: string,
  inputSchema: z.ZodType,
  outputSchema: z.ZodType<T>,
  prompt: string,
  logBase: LogBase,
  options: { webSearch: boolean; startedAt: number },
): Promise<T> {
  const config = getAiConfig();
  const startedAt = options.startedAt;
  const cacheKey = taskCacheKey(taskName, prompt, inputSchema);

  async function attempt(
    promptText: string,
    withSearch: boolean,
  ): Promise<{
    data: T;
    usage: AiUsage;
  }> {
    const client = createOpenAIClient();
    const completion = await client.chat.completions.create(
      {
        model: config.model,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(outputSchema, withSearch),
          },
          { role: "user", content: promptText },
        ],
        temperature: LIVE_TEMPERATURE,
        max_tokens: LIVE_MAX_TOKENS,
        response_format: { type: "json_object" },
        ...(withSearch
          ? { web_search_options: { search_context_size: "medium" as const } }
          : {}),
      },
      { timeout: LIVE_TIMEOUT_MS },
    );

    const content = completion.choices[0]?.message?.content ?? "";
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error(
        `ai_invalid_json:${taskName}: model did not return JSON`,
      );
    }

    const validated = outputSchema.safeParse(raw);
    if (!validated.success) {
      throw new Error(
        `ai_invalid_output:${taskName}: ${validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      );
    }

    return {
      data: validated.data,
      usage: {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    };
  }

  async function logFailure(message: string): Promise<void> {
    await appendAiLog({
      ...logBase,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      status: "error",
      error: message,
    });
  }

  function isUnsupportedSearchError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const status = (error as { status?: number }).status;
    return (
      status === 400 &&
      /web_search|unknown.*(param|field)|unrecognized/i.test(error.message)
    );
  }

  try {
    let result: { data: T; usage: AiUsage };
    let withSearch = options.webSearch;
    let promptText = prompt;
    for (let triesLeft = 2; triesLeft > 0; triesLeft -= 1) {
      try {
        result = await attempt(promptText, withSearch);
        break;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "ai_request_failed";
        // The endpoint may not understand web-search options: fall back to a
        // plain call once and say so in the log, instead of failing the task.
        if (withSearch && isUnsupportedSearchError(error)) {
          await logFailure(
            `web_search_unsupported:${taskName}: retrying without browsing`,
          );
          withSearch = false;
          continue;
        }
        // One repair retry for malformed output only: show the model what was
        // wrong and ask for corrected JSON. Transport errors never retry here.
        if (
          triesLeft > 1 &&
          (message.startsWith("ai_invalid_json") ||
            message.startsWith("ai_invalid_output"))
        ) {
          await logFailure(`${message} (retrying once with repair hint)`);
          promptText = `${prompt}\n\nYour previous reply was not valid: ${message.slice(0, 300)}. Reply with ONLY the corrected JSON object.`;
          continue;
        }
        throw error;
      }
    }
    // TypeScript cannot see the loop always assigns; the throw above guards it.
    const done = result!;

    await writeTaskCache(taskName, cacheKey, done.data, done.usage);
    await appendAiLog({
      ...logBase,
      cacheHit: false,
      tokens: done.usage,
      latencyMs: Date.now() - startedAt,
      status: "ok",
    });

    return done.data;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ai_request_failed";
    if (
      message.startsWith("ai_invalid_json") ||
      message.startsWith("ai_invalid_output")
    ) {
      await logFailure(message);
    } else {
      await appendAiLog({
        ...logBase,
        cacheHit: false,
        latencyMs: Date.now() - startedAt,
        status: "error",
        error: `ai_request_failed:${taskName}`,
      });
    }
    throw error instanceof Error ? error : new Error(message);
  }
}
