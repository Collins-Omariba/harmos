import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";
import {
  buildSuggestCatalogPartsPrompt,
  SUGGEST_CATALOG_PARTS_TASK,
  suggestCatalogParts,
  suggestCatalogPartsInputSchema,
  type SuggestCatalogPartsOutput,
} from "@/lib/ai/tasks/suggest_catalog_parts";

const input = {
  request: "Low-power LDOs under $1.",
  categoryHint: "ldo",
  knownMetrics: ["outputVoltageV", "quiescentCurrentA", "priceUsd"],
  knownCategories: ["ldo", "buck"],
  existingPartNumbers: ["AMS1117-3.3"],
};

test("suggest_catalog_parts returns a validated cache hit and logs it", async () => {
  const cacheDir = `/tmp/opencode/harmos-suggest-parts-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  const previousDemo = process.env.HARMOS_DEMO_MODE;
  process.env.HARMOS_CACHE_DIR = cacheDir;
  delete process.env.HARMOS_DEMO_MODE;

  try {
    const prompt = buildSuggestCatalogPartsPrompt(input);
    const key = taskCacheKey(
      SUGGEST_CATALOG_PARTS_TASK,
      prompt,
      suggestCatalogPartsInputSchema,
    );
    const cached: SuggestCatalogPartsOutput = {
      candidates: [
        {
          partNumber: "TEST-999",
          manufacturer: "Test Works",
          category: "ldo",
          description: "A test LDO.",
          package: "SOT-23-5",
          datasheetUrl: "https://example.com/ds.pdf",
          sourceUrl: "https://example.com/p",
          specs: { outputVoltageV: 3.3 },
          priceUsd: 0.35,
          tags: ["ldo"],
          confidence: "medium",
          note: "Fits the brief.",
        },
      ],
    };

    await writeTaskCache(SUGGEST_CATALOG_PARTS_TASK, key, cached);

    const result = await suggestCatalogParts(input);

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
    if (previousDemo !== undefined) {
      process.env.HARMOS_DEMO_MODE = previousDemo;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("the prompt carries guardrails and the existing catalog", () => {
  const prompt = buildSuggestCatalogPartsPrompt(input);

  assert.match(prompt, /never invent one/i);
  assert.match(prompt, /known list/i);
  assert.match(prompt, /AMS1117-3\.3/);
  assert.match(prompt, /ldo/);
});
