import assert from "node:assert/strict";
import test from "node:test";

import { intentLabel, routeQuestion } from "@/lib/assistant/router";

test("cost questions route to the BOM", () => {
  assert.equal(routeQuestion("How much does the BOM cost?").intent, "bom_cost");
  assert.equal(routeQuestion("Are we under budget?").intent, "bom_cost");
});

test("comparison questions route to trade-offs", () => {
  assert.equal(routeQuestion("Which LDO is best?").intent, "comparison");
  assert.equal(routeQuestion("TPS7A02 vs MCP1700").intent, "comparison");
  assert.equal(routeQuestion("Explain the trade-offs").intent, "comparison");
});

test("status, tests, and decisions route correctly", () => {
  assert.equal(routeQuestion("What is the project status?").intent, "project_status");
  assert.equal(routeQuestion("Did validation pass?").intent, "validation");
  assert.equal(routeQuestion("Why did we choose the LDO?").intent, "decisions");
  assert.equal(routeQuestion("What are the requirements?").intent, "requirements");
  assert.equal(routeQuestion("Cite the datasheets").intent, "resources");
  assert.equal(routeQuestion("What can you do?").intent, "capabilities");
});

test("unrecognized questions fall through to the open path", () => {
  assert.equal(routeQuestion("Tell me a story").intent, "open");
  assert.equal(routeQuestion("").intent, "open");
});

test("mentions match terms from the project's own data", () => {
  const routed = routeQuestion("Is the TPS7A02 still in the BOM?", [
    "TPS7A02",
    "MCP1700",
    "level-sensor",
  ]);
  assert.deepEqual(routed.mentions, ["TPS7A02"]);
  assert.equal(routed.intent, "bom_cost");
});

test("part questions route to components, not status", () => {
  assert.equal(
    routeQuestion("What is the main mcu in my projects?").intent,
    "components",
  );
  assert.equal(routeQuestion("List the parts.").intent, "components");
  assert.equal(routeQuestion("Which sensor are we using?").intent, "components");
  assert.equal(
    routeQuestion("What is on the board?", []).intent,
    "components",
  );
  assert.equal(
    routeQuestion("Tell me about capacitors.", []).intent,
    "components",
  );
  // Precedence: comparison, BOM, and requirement terms still win theirs.
  assert.equal(
    routeQuestion("Which part won the comparison?").intent,
    "comparison",
  );
  assert.equal(routeQuestion("What does the BOM total?").intent, "bom_cost");
  assert.equal(
    routeQuestion("What are the requirements?").intent,
    "requirements",
  );
});

test("mentions are case-insensitive, deduped, and length-gated", () => {
  const routed = routeQuestion("tps7a02 and TPS7A02?", ["TPS7A02", "ab"]);
  assert.deepEqual(routed.mentions, ["TPS7A02"]);
});

test("every intent has a plain-language label", () => {
  for (const intent of [
    "bom_cost",
    "comparison",
    "current_versions",
    "requirements",
    "resources",
    "validation",
    "decisions",
    "project_status",
    "suggest",
    "capabilities",
    "open",
  ] as const) {
    assert.ok(intentLabel(intent).length > 0);
  }
});
