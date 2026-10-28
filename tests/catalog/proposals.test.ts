import assert from "node:assert/strict";
import test from "node:test";

import { validateProposalCandidate } from "@/lib/catalog/proposals";
import type { CatalogCandidateDraft } from "@/lib/ai/tasks/suggest_catalog_parts";

function draft(overrides: Partial<CatalogCandidateDraft> = {}): CatalogCandidateDraft {
  return {
    partNumber: "TEST-999",
    manufacturer: "Test Works",
    category: "ldo",
    description: "A test LDO.",
    package: "SOT-23-5",
    datasheetUrl: "https://example.com/ds.pdf",
    sourceUrl: "https://example.com/p",
    specs: { outputVoltageV: 3.3, quiescentCurrentA: 0.000001 },
    priceUsd: 0.35,
    tags: ["ldo", "test"],
    confidence: "medium",
    note: "Fits the brief.",
    ...overrides,
  };
}

const NONE = new Set<string>();

test("a clean draft validates with no warnings", () => {
  const result = validateProposalCandidate(draft(), NONE);

  assert.ok("candidate" in result, "should validate");
  if ("candidate" in result) {
    assert.equal(result.candidate.partNumber, "TEST-999");
    assert.deepEqual(result.candidate.warnings, []);
    assert.equal(result.candidate.specs.outputVoltageV, 3.3);
  }
});

test("duplicates, unknown categories, and missing identity are fatal", () => {
  assert.ok(
    "error" in
      validateProposalCandidate(
        draft(),
        new Set(["test-999"]),
      ),
    "duplicate part number",
  );
  assert.ok(
    "error" in validateProposalCandidate(draft({ category: "toaster" }), NONE),
    "unknown category",
  );
  assert.ok(
    "error" in validateProposalCandidate(draft({ partNumber: "  " }), NONE),
    "missing part number",
  );
});

test("malformed URLs and unknown spec keys are stripped with warnings", () => {
  const result = validateProposalCandidate(
    draft({
      datasheetUrl: "not a url",
      sourceUrl: "ftp://example.com/p",
      specs: {
        outputVoltageV: 3.3,
        warpDrive: 9,
        rangeM: "far",
      } as Record<string, unknown>,
    }),
    NONE,
  );

  assert.ok("candidate" in result, "keeps the valid remainder");
  if ("candidate" in result) {
    assert.equal(result.candidate.datasheetUrl, null);
    assert.equal(result.candidate.sourceUrl, null);
    assert.deepEqual(result.candidate.specs, { outputVoltageV: 3.3 });
    assert.ok(
      result.candidate.warnings.some((w) => w.includes("datasheet")),
      "warns about the URL",
    );
    assert.ok(
      result.candidate.warnings.some((w) => w.includes("warpDrive")),
      "warns about the unknown spec",
    );
  }
});

test("a candidate with zero usable specs is rejected", () => {
  assert.ok(
    "error" in validateProposalCandidate(draft({ specs: { nope: 1 } }), NONE),
  );
  assert.ok(
    "error" in validateProposalCandidate(draft({ specs: {} }), NONE),
  );
});

test("bad prices become unknown, tags are cleaned", () => {
  const result = validateProposalCandidate(
    draft({ priceUsd: -5, tags: ["ldo", "", 4 as unknown as string] }),
    NONE,
  );

  assert.ok("candidate" in result);
  if ("candidate" in result) {
    assert.equal(result.candidate.priceUsd, null);
    assert.deepEqual(result.candidate.tags, ["ldo"]);
    assert.ok(result.candidate.warnings.some((w) => w.includes("price")));
  }
});
