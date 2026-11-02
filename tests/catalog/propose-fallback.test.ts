import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { renderToString } from "react-dom/server";
import React from "react";

import { proposeCatalogPartsAction } from "@/app/actions/catalog";
import { AddPartSideForm, RawOutputBox } from "@/components/catalog-proposer";
import { TooltipProvider } from "@/components/ui/tooltip";

function completionBody(content: string): string {
  return JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

function startFakeOpenAI(respond: () => string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(respond());
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve({ server, port: address.port });
    });
  });
}

function setEnv(vars: Record<string, string | undefined>) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return previous;
}

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function proposeForm(request: string): FormData {
  const form = new FormData();
  form.append("request", request);
  return form;
}

test("the model's text is shown verbatim for manual transcription", async () => {
  const cacheDir = `/tmp/opencode/harmos-propose-text-${process.pid}`;
  const reply = "TPS7A02 — Texas Instruments 200mA LDO in SOT-23-5, about $0.35.";
  const { server, port } = await startFakeOpenAI(() => completionBody(reply));
  const previous = setEnv({
    AI_API_KEY: "test-key",
    AI_BASE_URL: `http://127.0.0.1:${port}`,
    AI_MODEL: "test-model",
    HARMOS_CACHE_DIR: cacheDir,
    HARMOS_DEMO_MODE: undefined,
  });

  try {
    const state = await proposeCatalogPartsAction(
      null,
      proposeForm(`low-power LDO draft probe ${Date.now()}`),
    );
    assert.ok(state && state.ok, "text answers succeed");
    assert.match(state.message, /copy what you want/i);
    assert.equal(state.rawOutput, reply);
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    restoreEnv(previous);
  }
});

test("the side add-part form renders catalog fields for direct copying", () => {
  const html = renderToString(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(AddPartSideForm),
    ),
  );
  assert.ok(html.includes("Add part "));
  assert.ok(html.includes('name="partNumber"'), "has the part number field");
  assert.ok(html.includes('name="spec_supplyMinV"'), "has spec fields");
  assert.ok(html.includes("Add part to catalog"), "has the save action");
});

test("the raw-output box renders the text and a copy action", () => {
  const html = renderToString(
    React.createElement(RawOutputBox, { text: "TPS7A02 SOT-23-5" }),
  );
  assert.ok(html.includes("TPS7A02 SOT-23-5"), "shows the model text");
  assert.ok(html.includes("Copy"), "offers a copy action");
});
