import assert from "node:assert/strict";
import test from "node:test";

import { COMPARISON_METRICS, operatorsForMetric } from "@/lib/comparison/metrics";
import { PACK_DIMENSIONS, PACK_MAP, validatePackConstraints } from "@/lib/comparison/packs";
import { suggestConstraints } from "@/lib/comparison/suggest";

const KNOWN_METRICS = new Set(
  COMPARISON_METRICS.map((metric) => metric.metric),
);

test("pack constraints reference known metrics, operators, and categories", () => {
  assert.deepEqual(validatePackConstraints(), []);
});

test("pack ids are unique and dimensions are non-empty", () => {
  const ids = PACK_DIMENSIONS.flatMap((dimension) =>
    dimension.options.map((option) => option.id),
  );

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(PACK_MAP.size, ids.length);
  for (const dimension of PACK_DIMENSIONS) {
    assert.ok(dimension.options.length > 0, dimension.key);
  }
});

test("every pack operator is valid for its metric type", () => {
  for (const option of PACK_MAP.values()) {
    for (const constraint of option.constraints) {
      assert.ok(
        KNOWN_METRICS.has(constraint.metric),
        `${option.id}: ${constraint.metric}`,
      );
      assert.ok(
        (operatorsForMetric(constraint.metric) as string[]).includes(
          constraint.operator,
        ),
        `${option.id}: ${constraint.operator} on ${constraint.metric}`,
      );
    }
  }
});

test("role packs record requirements without scoring anything", () => {
  for (const id of ["role-iot", "role-power", "role-sensor"]) {
    const option = PACK_MAP.get(id);
    assert.ok(option, id);
    assert.equal(option?.constraints.length, 0);
    assert.ok((option?.requirement.text.length ?? 0) > 0);
  }
});

test("suggestions skip constraints the packs already cover", () => {
  // Wi-Fi pack has no sleep-current constraint, so the rule fires...
  const withWifi = suggestConstraints({
    brief: "A battery-powered sensor node.",
    packIds: ["wl-wifi"],
  });
  assert.ok(
    withWifi.some((suggestion) => suggestion.metric === "sleepCurrentA"),
  );

  // ...but battery-backup already covers quiescent, so that rule stays quiet
  // for the same metric+operator pair.
  const withBattery = suggestConstraints({
    brief: "Runs for months on a cell.",
    packIds: ["rail-liion", "pw-battery"],
  });
  const quiescent = withBattery.filter(
    (suggestion) => suggestion.metric === "quiescentCurrentA",
  );
  assert.equal(quiescent.length, 0);
});

test("brief keywords trigger environmental suggestions", () => {
  const suggestions = suggestConstraints({
    brief: "An outdoor waterproof tank monitor.",
    packIds: ["rail-3v3"],
  });

  assert.ok(
    suggestions.some((suggestion) => suggestion.metric === "ipRating"),
  );
});

test("unknown pack ids are ignored and output stays valid", () => {
  const suggestions = suggestConstraints({
    brief: "Outdoor monitor.",
    packIds: ["nope", "rail-3v3"],
  });

  for (const suggestion of suggestions) {
    assert.ok(KNOWN_METRICS.has(suggestion.metric), suggestion.metric);
    assert.ok(suggestion.reason.length > 0);
  }
});
