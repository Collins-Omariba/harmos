import assert from "node:assert/strict";
import test from "node:test";

import { parseCatalogCsv, slugifyPartNumber } from "@/lib/catalog/csv";

const HEADER =
  "id,partNumber,manufacturer,category,description,package,datasheetUrl,sourceUrl,sourceRetrievedAt,priceUsd,specsJson,tags";

function row(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    id: "",
    partNumber: "TEST-001",
    manufacturer: "Test Works",
    category: "ldo",
    description: "A test LDO.",
    package: "SOT-23-5",
    datasheetUrl: "https://example.com/ds.pdf",
    sourceUrl: "https://example.com/product",
    sourceRetrievedAt: "2026-10-01",
    priceUsd: "0.35",
    specsJson: '"{""outputVoltageV"":3.3}"',
    tags: "ldo;test",
    ...overrides,
  };

  return [
    values.id,
    values.partNumber,
    values.manufacturer,
    values.category,
    values.description,
    values.package,
    values.datasheetUrl,
    values.sourceUrl,
    values.sourceRetrievedAt,
    values.priceUsd,
    values.specsJson,
    values.tags,
  ].join(",");
}

test("a valid row parses with a derived id and typed fields", () => {
  const { parts, issues } = parseCatalogCsv(`${HEADER}\n${row()}`);

  assert.equal(issues.length, 0);
  assert.equal(parts.length, 1);
  assert.equal(parts[0]?.id, "cat-import-test-001");
  assert.equal(parts[0]?.category, "ldo");
  assert.equal(parts[0]?.priceUsd, 0.35);
  assert.deepEqual(parts[0]?.tags, ["ldo", "test"]);
  assert.deepEqual(parts[0]?.specs.outputVoltageV, 3.3);
});

test("quoted fields may contain commas", () => {
  const { parts, issues } = parseCatalogCsv(
    `${HEADER}\n${row({ description: '"Low noise, high PSRR LDO."' })}`,
  );

  assert.equal(issues.length, 0);
  assert.equal(parts[0]?.description, "Low noise, high PSRR LDO.");
});

test("a wrong header is rejected", () => {
  const wrong = parseCatalogCsv("a,b,c");
  assert.equal(wrong.parts.length, 0);
  assert.match(wrong.issues[0]?.message ?? "", /header must be exactly/);
});

test("bad category, price, specs, and duplicates are reported with lines", () => {
  const bad = parseCatalogCsv(
    [
      HEADER,
      row({ partNumber: "OK-1" }),
      row({ partNumber: "BAD-1", category: "toaster" }),
      row({ partNumber: "BAD-2", priceUsd: "free" }),
      row({ partNumber: "BAD-3", specsJson: '"not json"' }),
      row({ partNumber: "OK-1" }),
    ].join("\n"),
  );

  assert.equal(bad.parts.length, 1);
  assert.equal(bad.parts[0]?.partNumber, "OK-1");
  assert.deepEqual(
    bad.issues.map((issue) => issue.line),
    [3, 4, 5, 6],
  );
});

test("empty price and date default sensibly", () => {
  const { parts, issues } = parseCatalogCsv(
    `${HEADER}\n${row({ priceUsd: "", sourceRetrievedAt: "" })}`,
  );

  assert.equal(issues.length, 0);
  assert.equal(parts[0]?.priceUsd, null);
  assert.match(parts[0]?.sourceRetrievedAt ?? "", /^\d{4}-\d{2}-\d{2}/);
});

test("slugifyPartNumber is stable for re-imports", () => {
  assert.equal(slugifyPartNumber("TPS7A02"), "cat-import-tps7a02");
  assert.equal(slugifyPartNumber("MB 7040/X"), "cat-import-mb-7040-x");
});
