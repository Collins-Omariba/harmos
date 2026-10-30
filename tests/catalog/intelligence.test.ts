import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeCatalogGaps,
  catalogHealthQueue,
  findDuplicateGroups,
  searchCatalog,
} from "@/lib/catalog/intelligence";
import type { CatalogPart } from "@/lib/catalog/types";
import type { ComparisonConstraint } from "@/lib/comparison/types";

function part(overrides: Partial<CatalogPart> = {}): CatalogPart {
  return {
    id: "cat-1",
    partNumber: "TPS7A02",
    manufacturer: "Texas Instruments",
    category: "ldo",
    description: "Low dropout regulator.",
    package: "SOT-23-5",
    datasheetUrl: "https://example.com/ds.pdf",
    sourceUrl: "https://example.com/product",
    sourceRetrievedAt: "2026-10-20",
    priceUsd: 0.35,
    origin: "seeded",
    tags: ["ldo", "low-power"],
    specs: { supplyMinV: 1.7, supplyMaxV: 6, outputVoltageV: 3.3 },
    ...overrides,
  };
}

test("natural language catalog search honors category and price", () => {
  const result = searchCatalog(
    [
      part(),
      part({ id: "cat-2", partNumber: "EXPENSIVE", priceUsd: 4.5 }),
      part({ id: "cat-3", partNumber: "BUCK1", category: "buck" }),
    ],
    "what LDOs under $1 do we have?",
  );

  assert.equal(result.category, "ldo");
  assert.equal(result.priceCeiling, 1);
  assert.deepEqual(result.parts.map((p) => p.partNumber), ["TPS7A02"]);
});

test("gap analysis flags categories with no passing part", () => {
  const constraint: ComparisonConstraint = {
    id: "c1",
    label: "Runs from 3.3 V",
    metric: "supplyVoltageV",
    operator: "covers",
    value: 3.3,
    unit: "V",
    kind: "mandatory",
    appliesTo: ["ldo", "cellular"],
  };

  const gaps = analyzeCatalogGaps([constraint], [part()]);
  assert.equal(gaps[0]?.totalPassing, 1);
  assert.deepEqual(gaps[0]?.gapCategories, ["cellular"]);
});

test("unscoped gap analysis only demands metric-relevant categories", () => {
  const constraint: ComparisonConstraint = {
    id: "c2",
    label: "Measures 2 m",
    metric: "rangeM",
    operator: "gte",
    value: 2,
    unit: "m",
    kind: "mandatory",
    appliesTo: [],
  };

  const gaps = analyzeCatalogGaps(
    [constraint],
    [
      part(),
      part({
        id: "cat-range",
        partNumber: "RANGE1",
        category: "level-sensor",
        specs: { rangeM: 1 },
      }),
    ],
  );

  assert.deepEqual(gaps[0]?.gapCategories, ["level-sensor"]);
  assert.equal(gaps[0]?.passingByCategory.length, 1);
});

test("duplicate detection groups normalized and near part numbers", () => {
  const groups = findDuplicateGroups([
    part(),
    part({ id: "cat-2", partNumber: "TPS-7A02" }),
    part({ id: "cat-3", partNumber: "TPS7A02-VERIFY" }),
    part({ id: "cat-4", partNumber: "OTHER", manufacturer: "Other" }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.length, 3);
});

test("health queue prioritizes stale sparse rows", () => {
  const queue = catalogHealthQueue(
    [
      part(),
      part({
        id: "cat-old",
        partNumber: "OLD1",
        sourceRetrievedAt: "2024-01-01",
        priceUsd: null,
        specs: {},
      }),
    ],
    new Date("2026-10-30"),
  );

  assert.equal(queue[0]?.part.partNumber, "OLD1");
  assert.ok(queue[0]?.issues.some((issue) => issue.includes("months old")));
});
