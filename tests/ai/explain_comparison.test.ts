import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  taskCacheKey,
  writeTaskCache,
} from "@/lib/ai/client";
import {
  EXPLAIN_COMPARISON_TASK,
  buildExplainComparisonPrompt,
  explainComparison,
  explainComparisonInputSchema,
  type ExplainComparisonOutput,
} from "@/lib/ai/tasks/explain_comparison";
import type { ExplainComparisonInput } from "@/lib/comparison/types";

const input: ExplainComparisonInput = {
  requirements: [
    { text: "Measure tank level", kind: "mandatory", status: "confirmed" },
  ],
  candidates: [
    {
      partNumber: "TEST-001",
      manufacturer: "Test Works",
      category: "level-sensor",
      score: 100,
      status: "pass",
      constraints: [
        {
          label: "Runs from 3.3 V",
          kind: "mandatory",
          expected: "covers 3.3 V",
          actual: "3.0–5.5 V",
          passed: true,
        },
      ],
    },
  ],
};

test("explain_comparison returns a validated cache hit and logs it", async () => {
  const cacheDir = `/tmp/opencode/harmos-explain-cache-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildExplainComparisonPrompt(input);
    const key = taskCacheKey(
      EXPLAIN_COMPARISON_TASK,
      prompt,
      explainComparisonInputSchema,
    );
    const cached: ExplainComparisonOutput = {
      summary: "TEST-001 meets every constraint.",
      verdicts: [
        {
          partNumber: "TEST-001",
          verdict: "pass",
          reason: "It covers the 3.3 V rail and meets the level requirement.",
        },
      ],
    };

    await writeTaskCache(EXPLAIN_COMPARISON_TASK, key, cached);

    const result = await explainComparison(input);

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
