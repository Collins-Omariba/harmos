import assert from "node:assert/strict";
import test from "node:test";

import { assembleProjectFromPacks } from "@/lib/comparison/assemble";

test("packs assemble requirements and pre-scoped constraints", () => {
  const result = assembleProjectFromPacks({
    name: "Field node",
    brief: "An outdoor LoRa sensor node on a Li-ion cell.",
    packIds: ["rail-3v3", "wl-lora", "role-iot"],
    extras: [],
  });

  assert.ok(!("error" in result), "should assemble");
  if ("error" in result) return;

  assert.equal(result.requirements.length, 3);
  assert.ok(
    result.requirements.some((r) => r.text.includes("3.3 V")),
    "rail requirement present",
  );

  const lora = result.constraints.find(
    (c) => c.metric === "wireless" && c.value === "lora",
  );
  assert.ok(lora, "LoRa constraint present");
  assert.deepEqual(lora?.appliesTo, ["mcu"]);

  const rail = result.constraints.find(
    (c) => c.metric === "supplyVoltageV",
  );
  assert.ok(rail && !rail.appliesTo.includes("battery"));
});

test("unknown packs are rejected", () => {
  const result = assembleProjectFromPacks({
    name: "X",
    brief: "Y",
    packIds: ["warp-drive"],
    extras: [],
  });

  assert.ok("error" in result);
});

test("accepted extras merge and duplicates are skipped", () => {
  const result = assembleProjectFromPacks({
    name: "Field node",
    brief: "Outdoor monitor.",
    packIds: ["rail-3v3"],
    extras: [
      {
        label: "Duplicate of pack constraint",
        metric: "supplyVoltageV",
        operator: "covers",
        value: 3.3,
        unit: "V",
        kind: "mandatory",
        appliesTo: [],
      },
      {
        label: "Ingress protection",
        metric: "ipRating",
        operator: "gte",
        value: 65,
        unit: "IP",
        kind: "preference",
        appliesTo: ["level-sensor"],
      },
    ],
  });

  assert.ok(!("error" in result), "should assemble");
  if ("error" in result) return;

  const rail = result.constraints.filter(
    (c) => c.metric === "supplyVoltageV",
  );
  assert.equal(rail.length, 1);
  assert.ok(
    result.constraints.some((c) => c.metric === "ipRating"),
  );
});

test("invalid extras are rejected with the suggestion label", () => {
  const badMetric = assembleProjectFromPacks({
    name: "X",
    brief: "Y",
    packIds: [],
    extras: [
      {
        label: "Bogus",
        metric: "warpDrive",
        operator: "gte",
        value: 9,
        unit: null,
        kind: "preference",
        appliesTo: [],
      },
    ],
  });
  assert.ok("error" in badMetric);
  assert.match(
    (badMetric as { error: string }).error,
    /Bogus/,
  );

  const badCategory = assembleProjectFromPacks({
    name: "X",
    brief: "Y",
    packIds: [],
    extras: [
      {
        label: "Wrong scope",
        metric: "ipRating",
        operator: "gte",
        value: 65,
        unit: "IP",
        kind: "preference",
        appliesTo: ["toaster"],
      },
    ],
  });
  assert.ok("error" in badCategory);
});
