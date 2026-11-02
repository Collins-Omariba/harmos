import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { taskCacheKey, writeTaskCache } from "@/lib/ai/client";
import {
  buildSuggestCatalogPartsPrompt,
  SUGGEST_CATALOG_PARTS_TASK,
  suggestCatalogParts,
} from "@/lib/ai/tasks/suggest_catalog_parts";

const input = {
  request: "Low-power LDOs under $1.",
  categoryHint: "ldo",
};

test("suggest_catalog_parts returns cached reply text and logs it", async () => {
  const cacheDir = `/tmp/opencode/harmos-suggest-parts-${process.pid}`;
  const previousCacheDir = process.env.HARMOS_CACHE_DIR;
  const previousDemo = process.env.HARMOS_DEMO_MODE;
  process.env.HARMOS_CACHE_DIR = cacheDir;
  delete process.env.HARMOS_DEMO_MODE;

  try {
    const prompt = buildSuggestCatalogPartsPrompt(input);
    const key = taskCacheKey(
      `${SUGGEST_CATALOG_PARTS_TASK}/text`,
      prompt,
      (await import("zod")).z.object({}),
    );
    const cached = "TPS7A02 — Texas Instruments LDO, SOT-23-5.";
    await writeTaskCache(SUGGEST_CATALOG_PARTS_TASK, key, cached);

    const result = await suggestCatalogParts(input);

    assert.equal(result, cached);

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

test("the prompt is a plain request for readable text, never JSON", () => {
  const prompt = buildSuggestCatalogPartsPrompt(input);

  assert.doesNotMatch(prompt, /JSON/);
  assert.doesNotMatch(prompt, /{"candidates"/);
  assert.doesNotMatch(prompt, /known list/i);
  assert.match(prompt, /Propose 1-6 real, orderable/);
  assert.match(prompt, /Low-power LDOs under \$1\./);
  assert.match(prompt, /Category hint: ldo/);
  assert.match(prompt, /Never invent/);
});
