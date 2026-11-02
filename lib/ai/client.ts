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

/** First 300 chars, single-lined, for failure messages. */
function rawExcerpt(content: string, maxChars = 300): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= maxChars ? flat : `${flat.slice(0, maxChars)}…`;
}

/**
 * Full prompt + raw model reply dumps for debugging model behavior.
 * Opt-in via HARMOS_AI_DEBUG=1; writes one JSON file per attempt under
 * logs/ai-debug/. Off by default — replies can be large.
 */
async function dumpAiDebug(
  taskName: string,
  cacheKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (process.env.HARMOS_AI_DEBUG !== "1") return;
  const dir = path.resolve(process.cwd(), "logs", "ai-debug");
  await mkdir(dir, { recursive: true });
  const file = path.join(
    dir,
    `${safeTaskName(taskName)}-${Date.now()}-${cacheKey.slice(0, 8)}.json`,
  );
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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
/**
 * Text tasks start here, not at LIVE_MAX_TOKENS: reasoning models spend part
 * of the output budget on hidden thinking before emitting any visible text,
 * so a 4k (or even 8k) budget can end at `finish_reason: "length"` with an
 * empty message — that is exactly what the 4k/8k debug dumps show, while
 * the same prompt completed at 16k. One generous budget up front replaces
 * the old retry-and-double ladder. `AI_MAX_TOKENS` can raise this further
 * but not lower it (a stale `AI_MAX_TOKENS=4000` in .env must not starve
 * text calls back into empty replies).
 */
export const LIVE_TEXT_MAX_TOKENS = 16_000;

/** `AI_MAX_TOKENS` when set to a positive integer, else `fallback`. */
export function resolveMaxTokens(fallback: number): number {
  const raw = Number(process.env.AI_MAX_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

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
/**
 * One streamed chunk from the model. `text` is visible answer text;
 * `reasoning` is the model's thinking text — only populated when the
 * provider actually sends it (the current provider usually does not, which
 * is why answers seem to appear out of nowhere after a long silence).
 */
export type AiStreamDelta = { text: string; reasoning: string };
export type AiStreamCallback = (
  delta: AiStreamDelta,
) => void | Promise<void>;

function reasoningFromDelta(delta: unknown): string {
  if (!delta || typeof delta !== "object") return "";
  const record = delta as Record<string, unknown>;
  return typeof record.reasoning_content === "string"
    ? record.reasoning_content
    : typeof record.reasoning === "string"
      ? record.reasoning
      : "";
}

export type RunTaskOpts = {
  /** Ask the model to browse the web while answering (server-side search). */
  webSearch?: boolean;
  /**
   * Stream the reply and report each chunk. Only usable from route
   * handlers — server actions cannot push chunks to the browser.
   */
  onDelta?: AiStreamCallback;
  /**
   * Appended to the prompt when retrying without search after the endpoint
   * rejects web-search options. Lets tasks whose prompts demand browsing
   * (e.g. catalog drafting) degrade into an explicit no-browse mode instead
   * of failing their own guardrails.
   */
  noSearchPromptSuffix?: string;
  /** Fired when the no-search fallback triggers, so callers can say so. */
  onSearchUnsupported?: () => void;
};

/**
 * Thrown when the model replies with unusable output (not JSON, or JSON
 * that fails the output schema) even after the repair retry. Carries the
 * raw model text so callers can show it to the user for manual transcription
 * instead of dropping the work silently.
 */
export class AiOutputError extends Error {
  readonly taskName: string;
  readonly raw: string;

  constructor(taskName: string, message: string, raw: string) {
    super(message);
    this.name = "AiOutputError";
    this.taskName = taskName;
    this.raw = raw;
  }
}

/**
 * Plain-text twin of runTask for tasks where the human reads the reply
 * directly (no JSON shape to validate). Same caching, logging, demo-mode,
 * and API-key guards. Deliberately plain: one bare chat call — no
 * web-search or response-format options, no repair/strip/budget retry
 * ladder — and the model's text is returned as-is. Pass `onDelta` (route
 * handlers only) to stream chunks, including provider reasoning text when
 * the provider sends any, as they arrive.
 */
export async function runTextTask(
  taskName: string,
  prompt: string,
  opts?: { onDelta?: AiStreamCallback },
): Promise<string> {
  const startedAt = Date.now();
  const config = getAiConfig();
  // The "/text" namespace keeps text caches apart from JSON-task caches.
  const cacheKey = taskCacheKey(`${taskName}/text`, prompt, z.object({}));
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

  const cached = await readTaskCache(taskName, cacheKey, z.string());
  if (cached !== null) {
    await appendAiLog({
      ...logBase,
      cacheHit: true,
      latencyMs: Date.now() - startedAt,
      status: "cache_hit",
    });
    await opts?.onDelta?.({ text: cached, reasoning: "" });
    return cached;
  }

  if (config.demoMode) {
    const error = `demo_mode_cache_miss:${taskName}`;
    await appendAiLog({
      ...logBase,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      status: "error",
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

  // One bare call. No web_search_options / response_format, and no retry
  // ladder: the previous ladder started at 4k, got empty `length` replies,
  // and burned two full calls doubling 4k -> 8k before 16k finally worked.
  const maxTokens = Math.max(
    resolveMaxTokens(LIVE_TEXT_MAX_TOKENS),
    LIVE_TEXT_MAX_TOKENS,
  );

  const client = createOpenAIClient();
  const requestBody = {
    model: config.model,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a hardware engineering assistant. Reply in readable plain text. No JSON unless asked.",
      },
      { role: "user" as const, content: prompt },
    ],
    temperature: LIVE_TEMPERATURE,
    max_tokens: maxTokens,
  };
  let text = "";
  let reasoning = "";
  let finishReason = "unknown";
  let usage: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  try {
    if (opts?.onDelta) {
      const stream = await client.chat.completions.create(
        { ...requestBody, stream: true },
        { timeout: LIVE_TIMEOUT_MS },
      );
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const deltaText = delta?.content ?? "";
        const deltaReasoning = reasoningFromDelta(delta);
        text += deltaText;
        reasoning += deltaReasoning;
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens: chunk.usage.total_tokens ?? 0,
          };
        }
        if (deltaText || deltaReasoning) {
          await opts.onDelta({ text: deltaText, reasoning: deltaReasoning });
        }
      }
    } else {
      const completion = await client.chat.completions.create(
        requestBody,
        { timeout: LIVE_TIMEOUT_MS },
      );
      const choice = completion.choices[0];
      finishReason = choice?.finish_reason ?? "unknown";
      text = choice?.message?.content ?? "";
      reasoning = reasoningFromDelta(choice?.message);
      usage = {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };
    }
  } catch (error) {
    await appendAiLog({
      ...logBase,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      status: "error",
      error: `ai_request_failed:${taskName}`,
    });
    throw error instanceof Error ? error : new Error("ai_request_failed");
  }

  await dumpAiDebug(taskName, cacheKey, {
    at: new Date().toISOString(),
    model: config.model,
    maxTokens,
    streamed: Boolean(opts?.onDelta),
    prompt,
    rawReply: text,
    finishReason,
    reasoningChars: reasoning.length,
    usage,
  });

  if (!text.trim()) {
    const message =
      finishReason === "length"
        ? `ai_empty_reply:${taskName}: no text after ${maxTokens} output tokens (finish_reason=length) — the model used its budget on hidden reasoning; raise AI_MAX_TOKENS above ${maxTokens} or use a non-reasoning model`
        : `ai_empty_reply:${taskName}: model returned no text (finish_reason=${finishReason})`;
    await appendAiLog({
      ...logBase,
      tokens: usage,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      status: "error",
      error: message,
    });
    throw new Error(message);
  }

  await writeTaskCache(taskName, cacheKey, text, usage);
  await appendAiLog({
    ...logBase,
    tokens: usage,
    cacheHit: false,
    latencyMs: Date.now() - startedAt,
    status: "ok",
  });
  return text;
}

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
    noSearchPromptSuffix: opts?.noSearchPromptSuffix,
    onSearchUnsupported: opts?.onSearchUnsupported,
    onDelta: opts?.onDelta,
    startedAt,
  });
}

type LogBase = Omit<AiLogEntry, "cacheHit" | "latencyMs" | "status"> & {
  latencyMs: number;
};

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

async function runLive<T>(
  taskName: string,
  inputSchema: z.ZodType,
  outputSchema: z.ZodType<T>,
  prompt: string,
  logBase: LogBase,
  options: {
    webSearch: boolean;
    noSearchPromptSuffix?: string;
    onSearchUnsupported?: () => void;
    onDelta?: AiStreamCallback;
    startedAt: number;
  },
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
    const requestBody = {
      model: config.model,
      messages: [
        {
          role: "system" as const,
          content: buildSystemPrompt(outputSchema, withSearch),
        },
        { role: "user" as const, content: promptText },
      ],
      temperature: LIVE_TEMPERATURE,
      max_tokens: resolveMaxTokens(LIVE_MAX_TOKENS),
      response_format: { type: "json_object" as const },
      ...(withSearch
        ? { web_search_options: { search_context_size: "medium" as const } }
        : {}),
    };
    let content = "";
    let finishReason = "unknown";
    let usage: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    if (options.onDelta) {
      const stream = await client.chat.completions.create(
        { ...requestBody, stream: true },
        { timeout: LIVE_TIMEOUT_MS },
      );
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const deltaText = delta?.content ?? "";
        const deltaReasoning = reasoningFromDelta(delta);
        content += deltaText;
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens: chunk.usage.total_tokens ?? 0,
          };
        }
        if (deltaText || deltaReasoning) {
          await options.onDelta({
            text: deltaText,
            reasoning: deltaReasoning,
          });
        }
      }
    } else {
      const completion = await client.chat.completions.create(
        requestBody,
        { timeout: LIVE_TIMEOUT_MS },
      );
      content = completion.choices[0]?.message?.content ?? "";
      finishReason = completion.choices[0]?.finish_reason ?? "unknown";
      usage = {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };
    }
    await dumpAiDebug(taskName, cacheKey, {
      at: new Date().toISOString(),
      model: config.model,
      withSearch,
      streamed: Boolean(options.onDelta),
      maxTokens: resolveMaxTokens(LIVE_MAX_TOKENS),
      finishReason,
      prompt: promptText,
      rawReply: content,
      usage,
    });

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new AiOutputError(
        taskName,
        `ai_invalid_json:${taskName}: model did not return JSON (reply starts with: ${rawExcerpt(content) || "(empty)"})`,
        content,
      );
    }

    const validated = outputSchema.safeParse(raw);
    if (!validated.success) {
      throw new AiOutputError(
        taskName,
        `ai_invalid_output:${taskName}: ${validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")} (reply starts with: ${rawExcerpt(content) || "(empty)"})`,
        content,
      );
    }

    return { data: validated.data, usage };
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
          options.onSearchUnsupported?.();
          if (options.noSearchPromptSuffix) {
            promptText = `${promptText}${options.noSearchPromptSuffix}`;
          }
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
          promptText = `${promptText}\n\nYour previous reply was not valid: ${message.slice(0, 300)}. Reply with ONLY the corrected JSON object.`;
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
