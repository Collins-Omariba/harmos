import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";
import React from "react";

import {
  AiComponentProposeBox,
  AlsoAddToCatalogFields,
} from "@/components/component-manager";

test("the project Add component AI box renders a search prompt and button", () => {
  const html = renderToString(React.createElement(AiComponentProposeBox));
  assert.ok(html.includes("Ask AI for part ideas"), "labels the AI search");
  assert.ok(html.includes("Search with AI"), "offers the search action");
  assert.ok(
    html.includes("readable text back"),
    "promises plain text, not structured picks",
  );
  assert.ok(html.includes("comp-ai-request"), "has a request field");
});

test("the also-add-to-catalog toggle starts collapsed", () => {
  const html = renderToString(React.createElement(AlsoAddToCatalogFields));
  assert.ok(html.includes("Also add this part to the catalog"));
  assert.ok(html.includes('name="alsoAddToCatalog"'), "submits the opt-in flag");
  assert.ok(
    !html.includes("comp-catalog-category"),
    "catalog fields stay hidden until ticked",
  );
});
