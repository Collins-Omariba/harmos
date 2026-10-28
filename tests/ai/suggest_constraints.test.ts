import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";
import {
  buildSuggestConstraintsPrompt,
  SUGGEST_CONSTRAINTS_TASK,
  suggestConstraints,
  suggestConstraintsInputSchema,
  type SuggestConstraintsOutput,
} from "@/lib/ai/tasks/suggest_constraints";
import type { ConstraintSuggestion } from "@/lib/comparison/suggest";

const input = {
  brief: "A battery-powered outdoor tank monitor.",
  packIds: ["rail-3v3", "bus-i2c"],
  chosen: [
    {
      label: "Runs from the 3.3 V rail",
      metric: "supplyVoltageV",
      operator: "covers",
      kind: "mandatory",
    },
  ],
  metrics: ["supplyVoltageV", "ipRating", "sleepCurrentA", "interfaces"],
  categories: ["level-sensor", "mcu", "environmental-sensor"],
};

const fallback: ConstraintSuggestion[] = [
  {
    label: "Rule suggestion",
    metric: "sleepCurrentA",
    operator: "lte",
    value: 0.00005,
    unit: "A",
    kind: "preference",
    appliesTo: ["mcu"],
    reason: "Rules, not the model.",
  },
];

test("suggest_constraints returns a validated cache hit and logs it", async () => {
  const cacheDir = `/tmp/opencode/harmos-suggest-cache-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildSuggestConstraintsPrompt(input);
    const key = taskCacheKey(
      SUGGEST_CONSTRAINTS_TASK,
      prompt,
      suggestConstraintsInputSchema,
    );
    const cached: SuggestConstraintsOutput = {
      suggestions: [
        {
          label: "Ingress protection of IP65 or better",
          metric: "ipRating",
          operator: "gte",
          value: 65,
          unit: "IP",
          kind: "preference",
          appliesTo: ["level-sensor"],
          reason: "The brief puts hardware outdoors.",
        },
      ],
    };

    await writeTaskCache(SUGGEST_CONSTRAINTS_TASK, key, cached);

    const result = await suggestConstraints(input, fallback);

    assert.equal(result.source, "ai");
    assert.deepEqual(result.suggestions, cached.suggestions);

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

test("suggest_constraints falls back to rules on a cache miss", async () => {
  const cacheDir = `/tmp/opencode/harmos-suggest-miss-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const result = await suggestConstraints(input, fallback);

    assert.equal(result.source, "rules");
    assert.deepEqual(result.suggestions, fallback);
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("suggest_constraints drops repeats and unknown metrics", async () => {
  const cacheDir = `/tmp/opencode/harmos-suggest-filter-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildSuggestConstraintsPrompt(input);
    const key = taskCacheKey(
      SUGGEST_CONSTRAINTS_TASK,
      prompt,
      suggestConstraintsInputSchema,
    );
    await writeTaskCache(SUGGEST_CONSTRAINTS_TASK, key, {
      suggestions: [
        {
          label: "Repeat of chosen",
          metric: "supplyVoltageV",
          operator: "covers",
          value: 3.3,
          unit: "V",
          kind: "mandatory",
          appliesTo: [],
          reason: "Should be filtered.",
        },
        {
          label: "Unknown metric",
          metric: "warpDrive",
          operator: "gte",
          value: 9,
          unit: null,
          kind: "preference",
          appliesTo: [],
          reason: "Should be filtered.",
        },
        {
          label: "Good one",
          metric: "ipRating",
          operator: "gte",
          value: 65,
          unit: "IP",
          kind: "preference",
          appliesTo: ["level-sensor"],
          reason: "Kept.",
        },
      ],
    });

    const result = await suggestConstraints(input, fallback);

    assert.equal(result.source, "ai");
    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0]?.metric, "ipRating");
  } finally {
    if (previousCacheDir === undefined) {
      delete process.env.HARMOS_CACHE_DIR;
    } else {
      process.env.HARMOS_CACHE_DIR = previousCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});
