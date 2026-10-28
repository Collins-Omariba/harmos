import assert from "node:assert/strict";
import test from "node:test";

import {
  briefKeywords,
  scoreResourceOverlap,
  selectTopResources,
} from "@/lib/research/heuristic";

const RESOURCES = [
  {
    id: "r1",
    title: "MB7040 datasheet",
    summary: "Weather-resistant ultrasonic rangefinder for level sensing.",
    tags: ["level-sensor", "ultrasonic"],
  },
  {
    id: "r2",
    title: "ESP32-WROOM-32E datasheet",
    summary: "Wi-Fi and Bluetooth module.",
    tags: ["mcu", "wifi"],
  },
  {
    id: "r3",
    title: "TPS7A02 datasheet",
    summary: "200 mA LDO with nano quiescent current.",
    tags: ["ldo"],
  },
];

test("brief keywords skip short words and stopwords", () => {
  assert.deepEqual(briefKeywords("An outdoor tank monitor for the field"), [
    "outdoor",
    "tank",
    "monitor",
    "field",
  ]);
});

test("overlap scoring weights titles over summaries", () => {
  const scored = scoreResourceOverlap(
    ["mb7040", "ultrasonic"],
    RESOURCES[0]!,
  );

  // "mb7040" hits the title (2 pts), "ultrasonic" only the summary/tags (1 pt).
  assert.equal(scored.score, 3);
  assert.deepEqual(scored.matched.sort(), ["mb7040", "ultrasonic"]);
});

test("unrelated resources score zero", () => {
  const scored = scoreResourceOverlap(["ultrasonic"], RESOURCES[1]!);
  assert.equal(scored.score, 0);
});

test("top selection ranks and caps results", () => {
  const top = selectTopResources(
    RESOURCES,
    "ultrasonic level sensor for a water tank with wifi reporting",
    2,
  );

  assert.equal(top[0]?.id, "r1");
  assert.ok(top.length <= 2);
  assert.ok(top.every((entry) => entry.score > 0));
});

test("no overlap means no selection", () => {
  assert.deepEqual(
    selectTopResources(RESOURCES, "quantum flux regulators"),
    [],
  );
});
