import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";
import React from "react";

import { SpecFields } from "@/components/catalog-spec-fields";
import { TooltipProvider } from "@/components/ui/tooltip";

function render(category: string, specs?: Record<string, unknown>): string {
  return renderToString(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(SpecFields, {
        id: "test",
        category,
        specs: specs as never,
      }),
    ),
  );
}

test("fields depend on the category", () => {
  const ldo = render("ldo");
  const mcu = render("mcu");

  assert.ok(ldo.includes('name="spec_outputVoltageV"'), "ldo shows output voltage");
  assert.ok(!/id="test-rangeM"/.test(ldo), "ldo hides range in primary fields");
  assert.ok(mcu.includes('name="spec_cpu"'), "mcu shows cpu");
  assert.ok(mcu.includes('name="spec_wireless"'), "mcu shows wireless");
  assert.ok(!/id="test-outputVoltageV"/.test(mcu), "mcu hides regulator fields");
});

test("out-of-category fields stay reachable under all fields", () => {
  const ldo = render("ldo");
  assert.ok(ldo.includes("All fields"), "overflow disclosure is rendered");
  assert.ok(
    ldo.includes('id="all-test-rangeM"'),
    "hidden metrics remain submittable inputs",
  );
});

test("prefilled overflow values force the disclosure open", () => {
  const closed = render("ldo", { outputVoltageV: 3.3 });
  const forced = render("ldo", {
    outputVoltageV: 3.3,
    sleepCurrentA: 0.00001,
  });

  assert.ok(!/<details open/.test(closed), "stays shut without overflow values");
  assert.ok(/<details open/.test(forced), "opens when values would be hidden");
});

test("every field carries an info icon with guidance", async () => {
  const { getMetricDef } = await import("@/lib/comparison/metrics");
  const html = render("adc");
  assert.ok(
    html.includes("About ADC resolution"),
    "info buttons are labelled per metric",
  );
  assert.equal(
    getMetricDef("sampleRateSps")?.help.includes("samples per second"),
    true,
    "help text lives on the metric def behind the icon",
  );
});
