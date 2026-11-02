import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";
import React from "react";

import { AiProgress, aiStageForElapsed } from "@/components/ai-progress";
import { ThinkingBox } from "@/components/catalog-proposer";

test("AiProgress shows a label, elapsed timer, and honest stage text", () => {
  const html = renderToString(
    React.createElement(AiProgress, { label: "Drafting catalog parts" }),
  );
  assert.ok(html.includes("Drafting catalog parts"));
  assert.ok(html.includes("0<!-- -->s"), "elapsed timer is visible from the start");
  assert.ok(html.includes("Sending your request"), "initial stage text");
  assert.ok(html.includes('role="status"'), "announced to assistive tech");
});

test("AiProgress compact mode stays a one-liner", () => {
  const html = renderToString(
    React.createElement(AiProgress, { label: "Drafting parts", compact: true }),
  );
  assert.ok(html.includes("Drafting parts"));
  assert.ok(!html.includes("Sending your request"), "no stage paragraph");
});

test("stage text explains silent reasoning as the wait grows", () => {
  assert.match(aiStageForElapsed(0), /Sending/);
  assert.match(aiStageForElapsed(10), /silently/);
  assert.match(aiStageForElapsed(30), /not a hang/);
  assert.match(aiStageForElapsed(60), /Hang tight/);
});

test("ThinkingBox renders provider reasoning text", () => {
  const html = renderToString(
    React.createElement(ThinkingBox, { text: "Considering TPS7A02…" }),
  );
  assert.ok(html.includes("Considering TPS7A02…"));
  assert.ok(html.includes("Model thinking"));
});
