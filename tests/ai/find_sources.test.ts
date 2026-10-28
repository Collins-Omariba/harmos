import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";
import {
  buildFindSourcesPrompt,
  FIND_SOURCES_TASK,
  findSources,
  findSourcesInputSchema,
  type FindSourcesOutput,
} from "@/lib/ai/tasks/find_sources";

const input = {
  query: "TPS7A02 low quiescent LDO",
  excludeUrls: ["https://example.com/old.pdf"],
};

test("find_sources returns a validated cache hit and logs it", async () => {
  const cacheDir = `/tmp/opencode/harmos-find-cache-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildFindSourcesPrompt(input);
    const key = taskCacheKey(
      FIND_SOURCES_TASK,
      prompt,
      findSourcesInputSchema,
    );
    const cached: FindSourcesOutput = {
      sources: [
        {
          title: "TPS7A02 datasheet",
          url: "https://example.com/tps7a02.pdf",
          snippet: "200 mA LDO with 25 nA quiescent current.",
        },
      ],
    };

    await writeTaskCache(FIND_SOURCES_TASK, key, cached);

    const result = await findSources(input);

    assert.deepEqual(result, { sources: cached.sources });

    const log = await readFile(
      path.resolve(process.cwd(), "logs", "ai.log"),
      "utf8",
    );
    const entry = log
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { cacheKey?: string; status?: string })
      .find((line) => line.cacheKey === key);

    assert.equal(entry?.status, "cache_hit");
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("find_sources drops javascript links, duplicates, and indexed urls", async () => {
  const cacheDir = `/tmp/opencode/harmos-find-filter-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildFindSourcesPrompt(input);
    const key = taskCacheKey(
      FIND_SOURCES_TASK,
      prompt,
      findSourcesInputSchema,
    );
    await writeTaskCache(FIND_SOURCES_TASK, key, {
      sources: [
        {
          title: "Good",
          url: "https://example.com/tps7a02.pdf",
          snippet: "Datasheet.",
        },
        {
          title: "Good again",
          url: "https://example.com/tps7a02.pdf",
          snippet: "Duplicate.",
        },
        { title: "XSS", url: "javascript:alert(1)", snippet: "Nope." },
        {
          title: "Old",
          url: "https://example.com/old.pdf",
          snippet: "Already indexed.",
        },
        { title: "FTP", url: "ftp://example.com/x", snippet: "Not web." },
      ],
    });

    const result = await findSources(input);

    assert.deepEqual(result, {
      sources: [
        {
          title: "Good",
          url: "https://example.com/tps7a02.pdf",
          snippet: "Datasheet.",
        },
      ],
    });
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});
