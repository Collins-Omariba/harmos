import { getMetricDef } from "@/lib/comparison/metrics";
import { PACK_MAP } from "@/lib/comparison/packs";
import type {
  ComparisonOperator,
  ConstraintKind,
  ConstraintValue,
} from "@/lib/comparison/types";

export type ConstraintSuggestion = {
  label: string;
  metric: string;
  operator: ComparisonOperator;
  value: ConstraintValue;
  unit: string | null;
  kind: ConstraintKind;
  appliesTo: string[];
  reason: string;
};

type SuggestionRule = {
  packs?: string[];
  briefKeywords?: string[];
  suggest: Omit<ConstraintSuggestion, "reason"> & { reason: string };
};

const RULES: SuggestionRule[] = [
  {
    packs: ["wl-wifi", "wl-ble"],
    suggest: {
      label: "Sleep current at or below 50 µA",
      metric: "sleepCurrentA",
      operator: "lte",
      value: 0.00005,
      unit: "A",
      kind: "preference",
      appliesTo: ["mcu"],
      reason: "Radio boards sleep between reports; sleep current decides battery life.",
    },
  },
  {
    packs: ["wl-wifi"],
    suggest: {
      label: "At least 1 MB of flash",
      metric: "flashKb",
      operator: "gte",
      value: 1024,
      unit: "KB",
      kind: "preference",
      appliesTo: ["mcu"],
      reason: "Wi-Fi stacks and TLS need room alongside application firmware.",
    },
  },
  {
    packs: ["wl-lora"],
    suggest: {
      label: "Rated down to -20 °C",
      metric: "operatingTempMinC",
      operator: "lte",
      value: -20,
      unit: "C",
      kind: "preference",
      appliesTo: [],
      reason: "LoRa nodes often live outdoors year-round.",
    },
  },
  {
    packs: ["rail-liion", "pw-battery"],
    suggest: {
      label: "Quiescent current at or below 10 µA",
      metric: "quiescentCurrentA",
      operator: "lte",
      value: 0.00001,
      unit: "A",
      kind: "preference",
      appliesTo: ["ldo", "buck", "load-switch", "battery-charger"],
      reason: "The regulator's idle draw runs 24/7 on a cell.",
    },
  },
  {
    packs: ["wl-lte"],
    suggest: {
      label: "Supports 2G fallback",
      metric: "wireless",
      operator: "includes",
      value: "gsm",
      unit: null,
      kind: "preference",
      appliesTo: ["cellular"],
      reason: "LTE-M coverage is patchy; 2G fallback keeps remote nodes reachable.",
    },
  },
  {
    packs: ["wl-gnss"],
    suggest: {
      label: "Draws at or below 50 mA while tracking",
      metric: "currentTypA",
      operator: "lte",
      value: 0.05,
      unit: "A",
      kind: "preference",
      appliesTo: ["gnss"],
      reason: "Fix acquisition is the hungriest part of a tracking cycle.",
    },
  },
  {
    briefKeywords: ["outdoor", "weather", "waterproof", "tank", "field"],
    suggest: {
      label: "Ingress protection of IP65 or better",
      metric: "ipRating",
      operator: "gte",
      value: 65,
      unit: "IP",
      kind: "preference",
      appliesTo: ["level-sensor", "environmental-sensor"],
      reason: "The brief puts hardware outside or in wet places.",
    },
  },
  {
    briefKeywords: ["battery", "months", "years", "low-power", "low power"],
    suggest: {
      label: "Sleep current at or below 50 µA",
      metric: "sleepCurrentA",
      operator: "lte",
      value: 0.00005,
      unit: "A",
      kind: "preference",
      appliesTo: ["mcu"],
      reason: "The brief asks for long battery life.",
    },
  },
];

export function suggestConstraints(input: {
  brief: string;
  packIds: string[];
}): ConstraintSuggestion[] {
  const selected = new Set(input.packIds.filter((id) => PACK_MAP.has(id)));
  const brief = input.brief.toLowerCase();

  // Metrics already covered by the selected packs (same metric+operator).
  const covered = new Set<string>();
  for (const id of selected) {
    const option = PACK_MAP.get(id);
    for (const constraint of option?.constraints ?? []) {
      covered.add(`${constraint.metric}+${constraint.operator}`);
    }
  }

  const suggestions: ConstraintSuggestion[] = [];

  for (const rule of RULES) {
    const packHit =
      !rule.packs || rule.packs.some((pack) => selected.has(pack));
    const briefHit =
      !rule.briefKeywords ||
      rule.briefKeywords.some((keyword) => brief.includes(keyword));

    if (!packHit || !briefHit) {
      continue;
    }
    if (
      covered.has(`${rule.suggest.metric}+${rule.suggest.operator}`) ||
      suggestions.some(
        (suggestion) =>
          suggestion.metric === rule.suggest.metric &&
          suggestion.operator === rule.suggest.operator,
      )
    ) {
      continue;
    }
    if (!getMetricDef(rule.suggest.metric)) {
      continue;
    }

    suggestions.push({ ...rule.suggest });
    covered.add(`${rule.suggest.metric}+${rule.suggest.operator}`);
  }

  return suggestions;
}
