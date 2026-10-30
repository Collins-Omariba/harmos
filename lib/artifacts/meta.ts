/**
 * Helpers for the structured non-firmware artifact metadata editor. The form
 * collects key/value rows and serializes them into the same `metaJson` hidden
 * field the server already validates, so the user never hand-writes JSON.
 */

export type ArtifactMetaRow = { key: string; value: string };

export function metaRowsFromJson(raw: string | null | undefined): ArtifactMetaRow[] {
  if (!raw) return [{ key: "", value: "" }];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [{ key: "", value: "" }];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [{ key: "", value: "" }];
  }
  const rows = Object.entries(parsed).map(([key, value]) => ({
    key,
    value:
      typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value),
  }));
  return rows.length > 0 ? rows : [{ key: "", value: "" }];
}

export function metaObjectFromRows(rows: ArtifactMetaRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key === "") continue;
    const value = row.value.trim();
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
