import assert from "node:assert/strict";
import test from "node:test";

import {
  STALE_AFTER_MONTHS,
  isSourceStale,
  sourceAgeLabel,
  sourceAgeMonths,
} from "@/lib/catalog/staleness";

const NOW = new Date("2026-10-28T00:00:00.000Z");

test("source age counts whole calendar months", () => {
  assert.equal(sourceAgeMonths("2026-10-01", NOW), 0);
  assert.equal(sourceAgeMonths("2026-09-15", NOW), 1);
  assert.equal(sourceAgeMonths("2025-10-28", NOW), 12);
  assert.equal(sourceAgeMonths("2026-11-01", NOW), 0);
  assert.equal(sourceAgeMonths("not-a-date", NOW), null);
});

test("age labels read naturally in the UI", () => {
  assert.equal(sourceAgeLabel("2026-10-01", NOW), "sourced this month");
  assert.equal(sourceAgeLabel("2026-08-01", NOW), "sourced 2 mo ago");
  assert.equal(sourceAgeLabel("bogus", NOW), "source date unknown");
});

test(`rows older than ${STALE_AFTER_MONTHS} months are stale`, () => {
  assert.equal(isSourceStale("2026-10-01", NOW), false);
  assert.equal(isSourceStale("2025-10-01", NOW), false);
  assert.equal(isSourceStale("2025-09-01", NOW), true);
  assert.equal(isSourceStale("bogus", NOW), false);
});
