import assert from "node:assert/strict";
import test from "node:test";

import { CATALOG_PARTS } from "@/lib/catalog/data";
import { validateSpecsObject } from "@/lib/catalog/specs";
import {
  CATALOG_CATEGORIES,
  isCatalogCategory,
} from "@/lib/catalog/types";
import { COMPARISON_PRESETS } from "@/lib/comparison/presets";
import { scoreCandidates } from "@/lib/comparison/scorer";

test("the local catalog has 80-120 real, sourced parts", () => {
  assert.ok(CATALOG_PARTS.length >= 80, "catalog is too small");
  assert.ok(CATALOG_PARTS.length <= 120, "catalog is too large");
});

test("catalog ids and part numbers are unique", () => {
  const ids = new Set(CATALOG_PARTS.map((part) => part.id));
  const partNumbers = new Set(CATALOG_PARTS.map((part) => part.partNumber));

  assert.equal(ids.size, CATALOG_PARTS.length);
  assert.equal(partNumbers.size, CATALOG_PARTS.length);
});

test("every catalog part has a manufacturer source, datasheet, and specs", () => {
  for (const part of CATALOG_PARTS) {
    assert.match(part.datasheetUrl, /^https:\/\//, part.partNumber);
    assert.match(part.sourceUrl, /^https:\/\//, part.partNumber);
    assert.ok(part.manufacturer.length > 0, part.partNumber);
    assert.ok(part.description.length > 0, part.partNumber);
    assert.ok(isCatalogCategory(part.category), part.partNumber);
    assert.ok(part.tags.length > 0, part.partNumber);
    assert.ok(
      Object.keys(part.specs).length > 0,
      `${part.partNumber} has no specs`,
    );
    assert.ok(
      part.priceUsd === null || part.priceUsd >= 0,
      `${part.partNumber} has an invalid price`,
    );
  }
});

test("every seeded specs object passes user-side validation", () => {
  for (const part of CATALOG_PARTS) {
    const result = validateSpecsObject(part.specs);
    assert.ok(!("error" in result), `${part.partNumber}: ${(result as { error?: string }).error}`);
  }
});

test("every catalog category has parts and a comparison preset", () => {
  for (const category of CATALOG_CATEGORIES) {
    const parts = CATALOG_PARTS.filter(
      (part) => part.category === category.key,
    );
    const preset = COMPARISON_PRESETS.find(
      (candidate) => candidate.key === category.key,
    );

    assert.ok(parts.length > 0, `${category.key} has no catalog parts`);
    assert.ok(preset, `${category.key} has no comparison preset`);
    assert.ok(
      (preset?.constraints.length ?? 0) > 0,
      `${category.key} has no constraints`,
    );
  }
});

test("the seeded presets score every catalog part deterministically", () => {
  for (const preset of COMPARISON_PRESETS) {
    const parts = CATALOG_PARTS.filter(
      (part) => part.category === preset.key,
    ).map((part) => ({ ...part, origin: "seeded" as const }));
    const constraints = preset.constraints.map((constraint, index) => ({
      ...constraint,
      id: `${preset.key}-${index}`,
      appliesTo: [],
    }));

    const first = scoreCandidates(parts, constraints);
    const second = scoreCandidates(parts, constraints);

    assert.deepEqual(
      first.map((score) => [score.part.partNumber, score.score, score.status]),
      second.map((score) => [score.part.partNumber, score.score, score.status]),
    );
    assert.equal(first.length, parts.length);
  }
});
