import assert from "node:assert/strict";
import test from "node:test";

import {
  isResourceKind,
  liveWebSearch,
  webSearchEnabled,
} from "@/lib/research";

test("web search is off by default", () => {
  const previous = process.env.HARMOS_WEB_SEARCH;
  delete process.env.HARMOS_WEB_SEARCH;

  try {
    assert.equal(webSearchEnabled(), false);
  } finally {
    if (previous !== undefined) {
      process.env.HARMOS_WEB_SEARCH = previous;
    }
  }
});

test("web search turns on only with the explicit flag", () => {
  const previous = process.env.HARMOS_WEB_SEARCH;
  process.env.HARMOS_WEB_SEARCH = "1";

  try {
    assert.equal(webSearchEnabled(), true);
  } finally {
    if (previous === undefined) {
      delete process.env.HARMOS_WEB_SEARCH;
    } else {
      process.env.HARMOS_WEB_SEARCH = previous;
    }
  }
});

test("live web search fails loudly until a provider is wired", async () => {
  const previous = process.env.HARMOS_WEB_SEARCH;
  delete process.env.HARMOS_WEB_SEARCH;

  try {
    await assert.rejects(liveWebSearch("TPS7A02 datasheet"), /web_search_disabled/);
  } finally {
    if (previous !== undefined) {
      process.env.HARMOS_WEB_SEARCH = previous;
    }
  }
});

test("resource kinds are a closed list", () => {
  assert.equal(isResourceKind("datasheet"), true);
  assert.equal(isResourceKind("blog"), false);
});
