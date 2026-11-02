import { COMPARISON_METRICS, getMetricDef } from "@/lib/comparison/metrics";
import type { CatalogSpecs } from "@/lib/catalog/types";

const KNOWN_SPECS = new Set(
  COMPARISON_METRICS.map((metric) => metric.metric),
);

function parseLeadingNumber(raw: string): number | null {
  const match = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** Drop binary float dust (1.6e-6 → 0.0000016, not …161). */
function tidy(value: number): number {
  return Number(value.toPrecision(12));
}

/**
 * Parse an engineering value with units ("3.3V", "500mA", "10µA", "-40℃",
 * "77°F"). Shared by distributor imports and AI drafts so sloppy-but-clear
 * values coerce instead of being dropped.
 */
export function parseEngineeringValue(
  raw: string,
  unit: "V" | "A" | "C",
): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = parseLeadingNumber(trimmed);
  if (value === null || !Number.isFinite(value)) return null;
  const lower = trimmed.toLowerCase();

  if (unit === "C") {
    const normalized = lower.replace(/℃/g, "c").replace(/℉/g, "f");
    if (!/[cf°]|deg/.test(normalized)) return null;
    if (normalized.includes("f") && !normalized.includes("c")) {
      return tidy((value - 32) * (5 / 9));
    }
    return tidy(value);
  }

  const milli = unit === "V" ? /mv\b/ : /ma\b/;
  const micro = /[µu]a\b/.test(lower) && unit === "A" ? true : /[µu]v\b/.test(lower) && unit === "V";
  if (micro) return tidy(value / 1_000_000);
  if (milli.test(lower)) return tidy(value / 1000);
  return tidy(value);
}

/**
 * Collapse wireless tokens to the canonical names the scorer matches
 * ("Bluetooth5.0" → "bluetooth", "Wi-Fi" → "wifi"). Unknown tokens pass
 * through lowercased.
 */
export function normalizeWirelessToken(raw: string): string | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  const compact = token.replace(/[^a-z0-9]/g, "");
  if (compact.includes("bluetooth")) return "bluetooth";
  if (compact.includes("wifi") || compact.includes("wlan")) return "wifi";
  if (compact.includes("zigbee")) return "zigbee";
  if (compact.includes("lora")) return "lora";
  if (compact.includes("lte")) return "lte";
  return token;
}

/**
 * Coerce a user- or model-supplied spec value to the number its metric
 * expects. Accepts plain numbers plus unit-suffixed strings ("3.3V",
 * "82mA", "-40℃", "77°F", "$0.35", "16-bit", "2500mAh"). Returns null when
 * nothing numeric can be salvaged.
 */
export function coerceSpecNumber(metric: string, raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== "string" || raw.trim() === "") return null;

  const unit = getMetricDef(metric)?.units[0];
  if (unit === "V" || unit === "A" || unit === "C") {
    return parseEngineeringValue(raw, unit);
  }
  return parseLeadingNumber(raw.trim());
}

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
      const coerced = coerceSpecNumber(key, entry);
      if (coerced === null) {
        return {
          error: `Spec "${key}" must be a number (e.g. "3.3V" works; ${JSON.stringify(entry)?.slice(0, 32) ?? "?" } has no number in it).`,
        };
      }
      (specs as Record<string, number>)[key] = coerced;
      continue;
    }

    if (def.metric === "interfaces" || def.metric === "wireless") {
      if (
        Array.isArray(entry) &&
        entry.every(
          (item): item is string =>
            typeof item === "string" && item.trim() !== "",
        )
      ) {
        (specs as Record<string, string[]>)[key] = (() => {
          const tokens = entry
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
          return def.metric === "wireless"
            ? tokens
                .map(normalizeWirelessToken)
                .filter((t): t is string => t !== null)
            : [...new Set(tokens)];
        })();
      } else if (typeof entry === "string") {
        const rawTokens = entry
          .split(/[,;|\n]/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        const tokens =
          def.metric === "wireless"
            ? rawTokens
                .map(normalizeWirelessToken)
                .filter((t): t is string => t !== null)
            : [...new Set(rawTokens)];
        if (tokens.length === 0) {
          return { error: `Spec "${key}" must not be empty.` };
        }
        (specs as Record<string, string[]>)[key] = tokens;
      } else {
        return {
          error: `Spec "${key}" must be a string or a string array.`,
        };
      }
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

/**
 * Spec fields that never appear as form inputs. `supplyVoltageV` is a
 * virtual constraint metric covered by supplyMinV/supplyMaxV at score time,
 * and `priceUsd` has its own price field in the part form.
 */
const FORM_EXCLUDED_SPECS = new Set(["supplyVoltageV", "priceUsd"]);

export function isSpecFormField(metric: string): boolean {
  return !FORM_EXCLUDED_SPECS.has(metric);
}

/**
 * Which spec metrics matter per catalog category. Derived from the spec keys
 * the seeded rows in each category actually carry, so the add/edit form only
 * asks for fields a part of that kind can score on. Anything outside the
 * list stays available under “All fields” so no stored value is ever lost.
 */
const CATEGORY_SPEC_METRICS: Record<string, string[]> = {
  "level-sensor": [
    "supplyMinV",
    "supplyMaxV",
    "currentTypA",
    "minRangeM",
    "rangeM",
    "resolutionMm",
    "accuracyMm",
    "operatingTempMinC",
    "operatingTempMaxC",
    "ipRating",
    "interfaces",
  ],
  mcu: [
    "supplyMinV",
    "supplyMaxV",
    "currentMaxA",
    "sleepCurrentA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "flashKb",
    "ramKb",
    "cpu",
    "interfaces",
    "wireless",
  ],
  ldo: [
    "supplyMinV",
    "supplyMaxV",
    "outputVoltageV",
    "outputCurrentMaxA",
    "quiescentCurrentA",
    "operatingTempMinC",
    "operatingTempMaxC",
  ],
  buck: [
    "supplyMinV",
    "supplyMaxV",
    "outputVoltageV",
    "outputCurrentMaxA",
    "quiescentCurrentA",
    "operatingTempMinC",
    "operatingTempMaxC",
  ],
  "battery-charger": [
    "supplyMinV",
    "supplyMaxV",
    "outputCurrentMaxA",
    "quiescentCurrentA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "interfaces",
  ],
  battery: [
    "batteryCapacityMah",
    "batteryNominalV",
    "currentMaxA",
    "operatingTempMinC",
    "operatingTempMaxC",
  ],
  "environmental-sensor": [
    "supplyMinV",
    "supplyMaxV",
    "currentTypA",
    "sleepCurrentA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "ipRating",
    "interfaces",
  ],
  adc: [
    "supplyMinV",
    "supplyMaxV",
    "currentTypA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "adcBits",
    "channels",
    "sampleRateSps",
    "interfaces",
  ],
  rtc: [
    "supplyMinV",
    "supplyMaxV",
    "currentTypA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "interfaces",
  ],
  "fuel-gauge": [
    "supplyMinV",
    "supplyMaxV",
    "currentTypA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "interfaces",
  ],
  "load-switch": [
    "supplyMinV",
    "supplyMaxV",
    "currentMaxA",
    "quiescentCurrentA",
    "operatingTempMinC",
    "operatingTempMaxC",
  ],
  transceiver: [
    "supplyMinV",
    "supplyMaxV",
    "currentTypA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "interfaces",
  ],
  cellular: [
    "supplyMinV",
    "supplyMaxV",
    "currentMaxA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "interfaces",
    "wireless",
  ],
  gnss: [
    "supplyMinV",
    "supplyMaxV",
    "currentTypA",
    "operatingTempMinC",
    "operatingTempMaxC",
    "interfaces",
  ],
};

export function specsForCategory(category: string): string[] {
  const metrics = CATEGORY_SPEC_METRICS[category];
  if (!metrics) {
    return COMPARISON_METRICS.filter((def) => isSpecFormField(def.metric)).map(
      (def) => def.metric,
    );
  }
  return metrics;
}

/**
 * Builds a specs object from structured `spec_<metric>` form entries, so the
 * add/edit UI never asks for raw JSON. Empty inputs are omitted; number
 * fields that do not parse are passed through as strings so
 * `validateSpecsObject` rejects them with a clear per-key message.
 */
export function specsFromFormEntries(
  get: (name: string) => string | null,
): unknown {
  const out: Record<string, unknown> = {};

  for (const def of COMPARISON_METRICS) {
    if (!isSpecFormField(def.metric)) continue;
    const raw = get(`spec_${def.metric}`);
    if (raw === null) continue;
    const trimmed = raw.trim();
    if (trimmed === "") continue;

    if (def.valueType === "number") {
      const num = Number(trimmed);
      out[def.metric] = Number.isFinite(num) ? num : trimmed;
      continue;
    }

    if (def.metric === "interfaces" || def.metric === "wireless") {
      out[def.metric] = trimmed
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    out[def.metric] = trimmed;
  }

  return out;
}
