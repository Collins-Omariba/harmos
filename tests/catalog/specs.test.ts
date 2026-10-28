import assert from "node:assert/strict";
import test from "node:test";

import { splitTags, validateSpecsObject } from "@/lib/catalog/specs";

test("a well-formed specs object passes through", () => {
  const result = validateSpecsObject({
    supplyMinV: 3.0,
    supplyMaxV: 5.5,
    interfaces: ["i2c", "uart"],
    cpu: "RISC-V",
  });

  assert.ok("specs" in result, "should validate");
  if ("specs" in result) {
    assert.equal(result.specs.supplyMinV, 3.0);
    assert.deepEqual(result.specs.interfaces, ["i2c", "uart"]);
  }
});

test("unknown spec keys are rejected, not ignored", () => {
  const result = validateSpecsObject({ warpDrive: 9 });
  assert.ok("error" in result);
  assert.match((result as { error: string }).error, /Unknown spec "warpDrive"/);
});

test("non-objects and bad values are rejected", () => {
  for (const bad of [
    null,
    "nope",
    [1, 2],
    { rangeM: Number.NaN },
    { rangeM: "far" },
    { interfaces: ["i2c", 4] },
    { interfaces: ["  "] },
  ]) {
    assert.ok(
      "error" in validateSpecsObject(bad),
      `should reject ${JSON.stringify(bad)}`,
    );
  }
});

test("an empty array documents a checked absence", () => {
  const result = validateSpecsObject({ wireless: [] });
  assert.ok("specs" in result, "should validate");
  if ("specs" in result) {
    assert.deepEqual(result.specs.wireless, []);
  }
});

test("splitTags accepts commas, semicolons, and newlines", () => {
  assert.deepEqual(splitTags("a, b;c\nd , ,e"), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(splitTags("   "), []);
});
