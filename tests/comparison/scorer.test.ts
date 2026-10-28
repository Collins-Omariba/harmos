import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogPart } from "@/lib/catalog/types";
import { scoreCandidate, scoreCandidates } from "@/lib/comparison/scorer";
import { buildDeterministicReason, buildDeterministicSummary } from "@/lib/comparison/summary";
import type { ComparisonConstraint } from "@/lib/comparison/types";

function part(overrides: Partial<CatalogPart> = {}): CatalogPart {
  return {
    id: "cat-test",
    partNumber: "TEST-001",
    manufacturer: "Test Works",
    category: "level-sensor",
    description: "Test part",
    package: "Module",
    datasheetUrl: "https://example.com/datasheet.pdf",
    sourceUrl: "https://example.com/product",
    sourceRetrievedAt: "2026-10-20",
    priceUsd: 10,
    tags: ["test"],
    specs: {
      supplyMinV: 3.0,
      supplyMaxV: 5.5,
      currentTypA: 0.004,
      rangeM: 5,
      resolutionMm: 10,
      operatingTempMinC: -20,
      operatingTempMaxC: 60,
      ipRating: 67,
      interfaces: ["i2c", "uart"],
      priceUsd: 10,
    },
    ...overrides,
  };
}

function constraint(
  overrides: Partial<ComparisonConstraint> = {},
): ComparisonConstraint {
  return {
    id: "constraint-1",
    label: "Runs from 3.3 V",
    metric: "supplyVoltageV",
    operator: "covers",
    value: 3.3,
    unit: "V",
    kind: "mandatory",
    appliesTo: [],
    ...overrides,
  };
}

test("passes every constraint and scores 100", () => {
  const score = scoreCandidate(part(), [
    constraint(),
    constraint({
      id: "constraint-2",
      label: "Range at least 2 m",
      metric: "rangeM",
      operator: "gte",
      value: 2,
      unit: "m",
    }),
  ]);

  assert.equal(score.status, "pass");
  assert.equal(score.score, 100);
  assert.equal(score.mandatoryPassed, 2);
  assert.equal(score.results.every((result) => result.passed), true);
});

test("fails when a mandatory constraint is not met", () => {
  const score = scoreCandidate(part(), [
    constraint({
      label: "Range at least 10 m",
      metric: "rangeM",
      operator: "gte",
      value: 10,
      unit: "m",
    }),
  ]);

  assert.equal(score.status, "fail");
  assert.equal(score.mandatoryPassed, 0);
  assert.equal(score.score, 0);
  assert.equal(score.results[0]?.passed, false);
});

test("reviews when only a preference is missed", () => {
  const score = scoreCandidate(part(), [
    constraint(),
    constraint({
      id: "constraint-2",
      label: "Price at or below $5",
      metric: "priceUsd",
      operator: "lte",
      value: 5,
      unit: "USD",
      kind: "preference",
    }),
  ]);

  assert.equal(score.status, "review");
  assert.equal(score.mandatoryPassed, 1);
  assert.equal(score.preferencePassed, 0);
  assert.equal(score.score, 67);
});

test("covers checks the supply range inclusively", () => {
  const inside = scoreCandidate(part(), [constraint()]);
  const outside = scoreCandidate(
    part({
      specs: { supplyMinV: 4.5, supplyMaxV: 5.5 },
    }),
    [constraint()],
  );

  assert.equal(inside.results[0]?.passed, true);
  assert.equal(outside.results[0]?.passed, false);
  assert.match(outside.results[0]?.actual ?? "", /4\.5–5\.5 V/);
});

test("includes matches arrays and strings without case sensitivity", () => {
  const arrayMatch = scoreCandidate(part(), [
    constraint({
      label: "Has I2C",
      metric: "interfaces",
      operator: "includes",
      value: "I2C",
      unit: null,
    }),
  ]);
  const stringMatch = scoreCandidate(
    part({ specs: { interfaces: ["I2C"] } }),
    [
      constraint({
        label: "Has I2C",
        metric: "interfaces",
        operator: "includes",
        value: "i2c",
        unit: null,
      }),
    ],
  );
  const miss = scoreCandidate(part({ specs: { interfaces: ["uart"] } }), [
    constraint({
      label: "Has I2C",
      metric: "interfaces",
      operator: "includes",
      value: "i2c",
      unit: null,
    }),
  ]);

  assert.equal(arrayMatch.results[0]?.passed, true);
  assert.equal(stringMatch.results[0]?.passed, true);
  assert.equal(miss.results[0]?.passed, false);
});

test("a missing metric never passes silently", () => {
  const score = scoreCandidate(part({ specs: {} }), [
    constraint({
      label: "Rated for IP65",
      metric: "ipRating",
      operator: "gte",
      value: 65,
      unit: "IP",
    }),
  ]);

  assert.equal(score.status, "fail");
  assert.equal(score.results[0]?.passed, false);
  assert.equal(score.results[0]?.actual, "not specified");
});

test("all numeric operators evaluate deterministically", () => {
  const specs = { resolutionMm: 10 };
  const operators = [
    ["gte", 10, true],
    ["lte", 10, true],
    ["gt", 9, true],
    ["lt", 11, true],
    ["eq", 10, true],
    ["neq", 11, true],
  ] as const;

  for (const [operator, value, expected] of operators) {
    const result = scoreCandidate(part({ specs }), [
      constraint({
        label: "Resolution",
        metric: "resolutionMm",
        operator,
        value,
        unit: "mm",
      }),
    ]);
    assert.equal(result.results[0]?.passed, expected, operator);
  }
});

test("scores sort by status, then score, then part number", () => {
  const pass = part({ id: "cat-a", partNumber: "A-1" });
  const review = part({
    id: "cat-b",
    partNumber: "B-1",
    specs: { supplyMinV: 3, supplyMaxV: 5.5, priceUsd: 99 },
  });
  const fail = part({
    id: "cat-c",
    partNumber: "C-1",
    specs: { supplyMinV: 4.5, supplyMaxV: 5.5 },
  });

  const scores = scoreCandidates([fail, review, pass], [
    constraint(),
    constraint({
      id: "constraint-2",
      label: "Price at or below $50",
      metric: "priceUsd",
      operator: "lte",
      value: 50,
      unit: "USD",
      kind: "preference",
    }),
  ]);

  assert.deepEqual(
    scores.map((score) => score.part.partNumber),
    ["A-1", "B-1", "C-1"],
  );
  assert.deepEqual(
    scores.map((score) => score.status),
    ["pass", "review", "fail"],
  );
});

test("deterministic summary mentions counts and the leader", () => {
  const scores = scoreCandidates([part()], [constraint()]);

  const summary = buildDeterministicSummary(scores);

  assert.match(summary, /1 candidate scored/);
  assert.match(summary, /1 pass/);
  assert.match(summary, /TEST-001 ranks first/);
});

test("constraints scoped to other categories are skipped, not failed", () => {
  const score = scoreCandidate(part(), [
    constraint(),
    constraint({
      id: "constraint-2",
      label: "LTE connectivity",
      metric: "wireless",
      operator: "includes",
      value: "lte",
      unit: null,
      appliesTo: ["cellular"],
    }),
  ]);

  assert.equal(score.status, "pass");
  assert.equal(score.score, 100);
  assert.equal(score.mandatoryPassed, 1);
  assert.equal(score.mandatoryTotal, 1);
  assert.equal(score.skipped, 1);

  const skipped = score.results.find(
    (result) => result.constraintId === "constraint-2",
  );
  assert.equal(skipped?.skipped, true);
  assert.equal(skipped?.passed, true);
});

test("a scoped-out mandatory constraint cannot fail the candidate", () => {
  const score = scoreCandidate(
    part({ specs: { supplyMinV: 3, supplyMaxV: 5.5 } }),
    [
      constraint({
        label: "Covers 12 V",
        metric: "supplyVoltageV",
        operator: "covers",
        value: 12,
        unit: "V",
        appliesTo: ["buck"],
      }),
    ],
  );

  assert.equal(score.status, "pass");
  assert.equal(score.results[0]?.skipped, true);
});

test("candidates passing nothing applicable still explain the skip", () => {
  const levelSensor = part({ category: "level-sensor" });
  const score = scoreCandidate(levelSensor, [
    constraint({
      id: "constraint-2",
      label: "LTE connectivity",
      metric: "wireless",
      operator: "includes",
      value: "lte",
      unit: null,
      appliesTo: ["cellular"],
    }),
  ]);

  assert.equal(score.status, "pass");
  assert.equal(score.score, 100);

  const reason = buildDeterministicReason(score);
  assert.match(reason, /does not apply to this category/);
});
