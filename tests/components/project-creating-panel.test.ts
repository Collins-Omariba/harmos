import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";
import React from "react";

import {
  creationStepForElapsed,
  ProjectCreatingPanel,
} from "@/components/new-project-button";

test("ProjectCreatingPanel shows the journey, timer, and project summary", () => {
  const html = renderToString(
    React.createElement(ProjectCreatingPanel, {
      name: "Greenhouse monitor",
      brief: "Battery-powered tank monitor, outdoor, reports over Wi-Fi.",
      packsCount: 3,
      extrasCount: 2,
    }),
  );
  assert.ok(html.includes("Building"), "announces what is being built");
  assert.ok(html.includes("Greenhouse monitor"), "shows the project name");
  assert.ok(html.includes("Saving your project"), "shows the first step");
  assert.ok(
    html.includes("AI explains the first comparison"),
    "shows the long AI step",
  );
  assert.ok(html.includes("0<!-- -->s"), "elapsed timer runs from the start");
  assert.ok(html.includes("Battery-powered tank monitor"), "re-reads the brief");
  assert.ok(html.includes("While you wait"), "offers a rotating note");
  assert.ok(html.includes('role="status"'), "announced to assistive tech");
});

test("creation steps advance with elapsed time", () => {
  assert.equal(creationStepForElapsed(0), 0);
  assert.equal(creationStepForElapsed(8), 1);
  assert.equal(creationStepForElapsed(30), 2);
  assert.equal(creationStepForElapsed(90), 3);
});
