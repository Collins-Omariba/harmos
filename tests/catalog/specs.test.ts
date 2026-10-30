import assert from "node:assert/strict";
import test from "node:test";

import { specsForCategory, specsFromFormEntries, splitTags, validateSpecsObject } from "@/lib/catalog/specs";

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

test("structured form entries build a validatable specs object", () => {
  const entries = new Map([
    ["spec_supplyMinV", "3.0"],
    ["spec_supplyMaxV", "5.5"],
    ["spec_interfaces", "i2c, uart"],
    ["spec_cpu", ""],
    ["spec_rangeM", ""],
  ]);
  const built = specsFromFormEntries((name) => entries.get(name) ?? null);

  assert.deepEqual(built, {
    supplyMinV: 3.0,
    supplyMaxV: 5.5,
    interfaces: ["i2c", "uart"],
  });

  const result = validateSpecsObject(built);
  assert.ok("specs" in result, "should validate");
});

test("form entries exclude virtual and price metrics, reject bad numbers", () => {
  const entries = new Map([
    ["spec_supplyVoltageV", "3.3"],
    ["spec_priceUsd", "0.35"],
    ["spec_rangeM", "far"],
  ]);
  const built = specsFromFormEntries((name) => entries.get(name) ?? null) as Record<
    string,
    unknown
  >;

  assert.ok(!("supplyVoltageV" in built), "virtual metric must be excluded");
  assert.ok(!("priceUsd" in built), "price has its own field");
  assert.ok("error" in validateSpecsObject(built), "bad number must fail");
});

test("every category maps to a non-empty subset of known form fields", async () => {
  const { COMPARISON_METRICS } = await import("@/lib/comparison/metrics");
  const { CATALOG_CATEGORIES } = await import("@/lib/catalog/types");
  const known = new Set(
    COMPARISON_METRICS.filter(
      (def) => def.metric !== "supplyVoltageV" && def.metric !== "priceUsd",
    ).map((def) => def.metric),
  );

  for (const category of CATALOG_CATEGORIES) {
    const fields = specsForCategory(category.key);
    assert.ok(fields.length >= 3, `${category.key} should show real fields`);
    assert.ok(
      fields.every((metric) => known.has(metric)),
      `${category.key} lists only known metrics`,
    );
  }

  assert.deepEqual(
    [...specsForCategory("not-a-category")].sort(),
    [...known].sort(),
    "unknown categories fall back to every field",
  );
});

test("seed catalog conforms to the category field map", async () => {
  const { CATALOG_PARTS } = await import("@/lib/catalog/data");

  for (const part of CATALOG_PARTS) {
    const allowed = new Set(specsForCategory(part.category));
    for (const key of Object.keys(part.specs)) {
      if (key === "priceUsd") continue;
      assert.ok(
        allowed.has(key),
        `${part.partNumber} (${part.category}) uses spec "${key}" outside its category fields`,
      );
    }
  }
});
