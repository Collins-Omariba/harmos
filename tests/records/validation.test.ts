import assert from "node:assert/strict";
import test from "node:test";

import { parseConstraintValue } from "@/lib/comparison/constraints";

test("numeric metrics accept finite numbers only", () => {
  assert.deepEqual(parseConstraintValue("rangeM", "gte", "2"), { value: 2 });
  assert.deepEqual(parseConstraintValue("priceUsd", "lte", "0.35"), {
    value: 0.35,
  });

  const bad = parseConstraintValue("rangeM", "gte", "far");
  assert.ok("error" in bad);
});

test("unknown metrics and mismatched operators are rejected", () => {
  assert.ok("error" in parseConstraintValue("toaster", "gte", "1"));
  assert.ok("error" in parseConstraintValue("rangeM", "bogus", "1"));
  assert.ok("error" in parseConstraintValue("rangeM", "includes", "1"));
});

test("string metrics accept text and list operators", () => {
  assert.deepEqual(parseConstraintValue("interfaces", "includes", "i2c"), {
    value: "i2c",
  });
  assert.deepEqual(parseConstraintValue("interfaces", "eq", "i2c"), {
    value: "i2c",
  });
  assert.ok("error" in parseConstraintValue("interfaces", "gte", "i2c"));
});

test("supply-voltage covers accepts a number", () => {
  assert.deepEqual(parseConstraintValue("supplyVoltageV", "covers", "3.3"), {
    value: 3.3,
  });
});
