import assert from "node:assert/strict";
import test from "node:test";

import {
  metaObjectFromRows,
  metaRowsFromJson,
} from "@/lib/artifacts/meta";

test("stored metadata parses back into editable rows", () => {
  const rows = metaRowsFromJson(
    JSON.stringify({ tool: "KiCad 9", layers: 2 }),
  );

  assert.deepEqual(rows, [
    { key: "tool", value: "KiCad 9" },
    { key: "layers", value: "2" },
  ]);
});

test("empty and corrupt metadata start with a blank row", () => {
  for (const raw of [null, undefined, "", "{}", "[1,2]", "not json"]) {
    assert.deepEqual(metaRowsFromJson(raw), [{ key: "", value: "" }]);
  }
});

test("rows serialize with numbers coerced and blanks dropped", () => {
  assert.deepEqual(
    metaObjectFromRows([
      { key: "tool", value: "KiCad 9" },
      { key: "layers", value: "2" },
      { key: "thickness", value: "1.6" },
      { key: "  ", value: "ignored" },
      { key: "", value: "ignored" },
    ]),
    { tool: "KiCad 9", layers: 2, thickness: 1.6 },
  );
});
