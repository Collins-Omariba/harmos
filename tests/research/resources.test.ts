import assert from "node:assert/strict";
import test from "node:test";

import { isResourceKind } from "@/lib/research";

test("resource kinds are a closed list", () => {
  assert.equal(isResourceKind("datasheet"), true);
  assert.equal(isResourceKind("blog"), false);
});
