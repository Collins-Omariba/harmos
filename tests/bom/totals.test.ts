import assert from "node:assert/strict";
import test from "node:test";

import {
  computeBomTotals,
  dollarsToCents,
  formatCents,
} from "@/lib/bom/totals";

test("line totals multiply quantity by unit price in integer cents", () => {
  const totals = computeBomTotals([
    {
      id: "a",
      partNumber: "A-1",
      manufacturer: "Acme",
      quantity: 3,
      unitPriceCents: 250,
    },
    {
      id: "b",
      partNumber: "B-1",
      manufacturer: "Acme",
      quantity: 1,
      unitPriceCents: 99,
    },
  ]);

  assert.equal(totals.totalCents, 849);
  assert.equal(totals.totalUnits, 4);
  assert.equal(totals.pricedLines, 2);
  assert.equal(totals.unpricedLines, 0);
  assert.deepEqual(
    totals.lines.map((line) => line.lineCents),
    [750, 99],
  );
});

test("unpriced lines are excluded from the total but counted", () => {
  const totals = computeBomTotals([
    {
      id: "a",
      partNumber: "A-1",
      manufacturer: "Acme",
      quantity: 2,
      unitPriceCents: null,
    },
    {
      id: "b",
      partNumber: "B-1",
      manufacturer: "Acme",
      quantity: 1,
      unitPriceCents: 100,
    },
  ]);

  assert.equal(totals.totalCents, 100);
  assert.equal(totals.pricedLines, 1);
  assert.equal(totals.unpricedLines, 1);
  assert.equal(totals.lines[0]?.lineCents, null);
});

test("empty and zero-quantity BOMs total to zero", () => {
  assert.equal(computeBomTotals([]).totalCents, 0);

  const totals = computeBomTotals([
    {
      id: "a",
      partNumber: "A-1",
      manufacturer: "Acme",
      quantity: 0,
      unitPriceCents: 500,
    },
  ]);
  assert.equal(totals.totalCents, 0);
  assert.equal(totals.totalUnits, 0);
});

test("dollarsToCents parses user input without floats", () => {
  assert.equal(dollarsToCents(""), null);
  assert.equal(dollarsToCents("  "), null);
  assert.equal(dollarsToCents("12.50"), 1250);
  assert.equal(dollarsToCents("$12.50"), 1250);
  assert.equal(dollarsToCents("3"), 300);
  assert.equal(dollarsToCents("0.99"), 99);
  assert.equal(dollarsToCents("abc"), null);
  assert.equal(dollarsToCents("12.345"), null);
  assert.equal(dollarsToCents("-5"), null);
});

test("formatCents renders USD without float drift", () => {
  assert.equal(formatCents(849), "$8.49");
  assert.equal(formatCents(100000), "$1,000.00");
});
