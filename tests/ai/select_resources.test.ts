import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";
import {
  buildSelectResourcesPrompt,
  SELECT_RESOURCES_TASK,
  selectResources,
  selectResourcesInputSchema,
  type SelectResourcesOutput,
} from "@/lib/ai/tasks/select_resources";

const input = {
  project: {
    name: "Water Tank Monitor",
    brief: "A solar-assisted ESP32 water-tank monitor.",
  },
  requirements: [
    { text: "Measure tank level.", kind: "mandatory", status: "confirmed" },
  ],
  index: [
    {
      id: "res-1",
      title: "MB7040 datasheet",
      kind: "datasheet",
      summary: "Weather-resistant ultrasonic rangefinder.",
      tags: ["level-sensor", "ultrasonic"],
    },
    {
      id: "res-2",
      title: "ESP32-WROOM-32E datasheet",
      kind: "datasheet",
      summary: "Wi-Fi and Bluetooth module.",
      tags: ["mcu", "wifi"],
    },
  ],
};

test("select_resources returns a validated cache hit and logs it", async () => {
  const cacheDir = `/tmp/opencode/harmos-select-cache-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildSelectResourcesPrompt(input);
    const key = taskCacheKey(
      SELECT_RESOURCES_TASK,
      prompt,
      selectResourcesInputSchema,
    );
    const cached: SelectResourcesOutput = {
      selections: [
        { id: "res-1", note: "Covers the level-sensing requirement." },
      ],
    };

    await writeTaskCache(SELECT_RESOURCES_TASK, key, cached);

    const result = await selectResources(input);

    assert.deepEqual(result, cached);

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

test("select_resources drops unknown and duplicate ids", async () => {
  const cacheDir = `/tmp/opencode/harmos-select-filter-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildSelectResourcesPrompt(input);
    const key = taskCacheKey(
      SELECT_RESOURCES_TASK,
      prompt,
      selectResourcesInputSchema,
    );
    await writeTaskCache(SELECT_RESOURCES_TASK, key, {
      selections: [
        { id: "res-1", note: "Kept." },
        { id: "res-1", note: "Duplicate." },
        { id: "res-ghost", note: "Hallucinated." },
      ],
    });

    const result = await selectResources(input);

    assert.deepEqual(result, {
      selections: [{ id: "res-1", note: "Kept." }],
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

test("select_resources throws loudly on a cache miss (no silent empty)", async () => {
  const cacheDir = `/tmp/opencode/harmos-select-miss-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.HARMOS_CACHE_DIR = cacheDir;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(selectResources(input), /OPENAI_API_KEY is not configured/);
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});
