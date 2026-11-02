import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";
import React from "react";

import { AiComponentProposeBox } from "@/components/component-manager";

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
