import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";
import {
  buildExplainChangeImpactPrompt,
  EXPLAIN_CHANGE_IMPACT_TASK,
  explainChangeImpact,
  explainChangeImpactInputSchema,
  type ExplainChangeImpactOutput,
} from "@/lib/ai/tasks/explain_change_impact";

const input = {
  componentSwap: {
    projectName: "Water Tank Monitor",
    from: { id: "comp-1", label: "OLD-MCU", detail: "Old module" },
    to: { id: "cat-1", label: "NEW-MCU", detail: "New module" },
  },
  edges: [{ from: "OLD-MCU", to: "Main Board", kind: "feeds" }],
  affectedArtifacts: [
    {
      id: "artifact-board",
      label: "Main Board",
      detail: "schematic · rev A",
      depth: 1,
      path: ["OLD-MCU", "Main Board"],
    },
    {
      id: "artifact-fw",
      label: "Firmware",
      detail: "firmware · v1.0.0",
      depth: 2,
      path: ["OLD-MCU", "Main Board", "Firmware"],
    },
  ],
};

test("explain_change_impact returns the computed set and logs a cache hit", async () => {
  const cacheDir = `/tmp/opencode/harmos-impact-cache-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  process.env.HARMOS_CACHE_DIR = cacheDir;

  try {
    const prompt = buildExplainChangeImpactPrompt(input);
    const key = taskCacheKey(
      EXPLAIN_CHANGE_IMPACT_TASK,
      prompt,
      explainChangeImpactInputSchema,
    );
    const cached: ExplainChangeImpactOutput = {
      affectedArtifactIds: ["artifact-fw", "invented-id"],
      reasoning: "Recheck the board first, then rebuild the firmware.",
    };

    await writeTaskCache(EXPLAIN_CHANGE_IMPACT_TASK, key, cached);

    const result = await explainChangeImpact(input);

    assert.deepEqual(result.affectedArtifactIds, [
      "artifact-board",
      "artifact-fw",
    ]);
    assert.equal(result.reasoning, cached.reasoning);

    const log = await readFile(path.resolve(process.cwd(), "logs", "ai.log"), "utf8");
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

test("the prompt makes the computed set authoritative", () => {
  const prompt = buildExplainChangeImpactPrompt(input);
  assert.match(prompt, /computed by traversing/);
  assert.match(prompt, /Never add, remove, rename, or reorder/);
  assert.match(prompt, /OLD-MCU/);
});
