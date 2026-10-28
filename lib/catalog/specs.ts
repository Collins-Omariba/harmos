import { COMPARISON_METRICS, getMetricDef } from "@/lib/comparison/metrics";
import type { CatalogSpecs } from "@/lib/catalog/types";

const KNOWN_SPECS = new Set(
  COMPARISON_METRICS.map((metric) => metric.metric),
);

/**
 * Validates a user-supplied specs object before it reaches the database.
 * Keys must be known metric names (the same universe the scorer and the
 * pack tests enforce). Number metrics take finite numbers; string metrics
 * take a non-empty string or a string array. An empty array is allowed and
 * means "none" — it documents a checked absence instead of an omission.
 */
export function validateSpecsObject(value: unknown):
  | { specs: CatalogSpecs }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Specs must be a JSON object." };
  }

  const specs: CatalogSpecs = {};

  for (const [key, entry] of Object.entries(value)) {
    const def = getMetricDef(key);
    if (!def) {
      return {
        error: `Unknown spec "${key}". Use one of: ${[...KNOWN_SPECS].join(", ")}.`,
      };
    }

    if (def.valueType === "number") {
      if (typeof entry !== "number" || !Number.isFinite(entry)) {
        return { error: `Spec "${key}" must be a finite number.` };
      }
      (specs as Record<string, number>)[key] = entry;
      continue;
    }

    if (typeof entry === "string") {
      if (entry.trim() === "") {
        return { error: `Spec "${key}" must not be empty.` };
      }
      (specs as Record<string, string>)[key] = entry;
    } else if (
      Array.isArray(entry) &&
      entry.every(
        (item): item is string =>
          typeof item === "string" && item.trim() !== "",
      )
    ) {
      (specs as Record<string, string[]>)[key] = entry;
    } else {
      return {
        error: `Spec "${key}" must be a string or a string array.`,
      };
    }
  }

  return { specs };
}

/** Tags accept commas, semicolons, or newlines as separators. */
export function splitTags(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
