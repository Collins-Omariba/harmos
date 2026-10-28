import assert from "node:assert/strict";
import test from "node:test";

import { catalogToComponentInput } from "@/lib/bom/fromCatalog";
import type { CatalogPart } from "@/lib/catalog/types";

function part(overrides: Partial<CatalogPart> = {}): CatalogPart {
  return {
    id: "cat-test",
    partNumber: "TEST-001",
    manufacturer: "Test Works",
    category: "ldo",
    description: "A test LDO.",
    package: "SOT-23-5",
    datasheetUrl: "https://example.com/ds.pdf",
    sourceUrl: "https://example.com/p",
    sourceRetrievedAt: "2026-10-20",
    priceUsd: 0.35,
    origin: "seeded",
    tags: ["ldo"],
    specs: { outputVoltageV: 3.3 },
    ...overrides,
  };
}

test("catalog rows map onto BOM inputs with converted prices", () => {
  const input = catalogToComponentInput(part(), 2);

  assert.equal(input.partNumber, "TEST-001");
  assert.equal(input.manufacturer, "Test Works");
  assert.equal(input.datasheetUrl, "https://example.com/ds.pdf");
  assert.equal(input.quantity, 2);
  assert.equal(input.unitPriceCents, 35);
});

test("unknown prices become unpriced lines, quantities clamp", () => {
  const input = catalogToComponentInput(
    part({ priceUsd: null, datasheetUrl: "" }),
    2.9,
  );

  assert.equal(input.unitPriceCents, null);
  assert.equal(input.quantity, 2);
  assert.equal(input.datasheetUrl, null);
});
