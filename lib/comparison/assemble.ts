import { parseConstraintValue } from "@/lib/comparison/constraints";
import { getMetricDef } from "@/lib/comparison/metrics";
import { CATALOG_CATEGORY_KEYS } from "@/lib/catalog";
import { PACK_MAP } from "@/lib/comparison/packs";
import type { ComparisonConstraint } from "@/lib/comparison/types";

export type AssembledProject = {
  requirements: { text: string; kind: string; status: string }[];
  constraints: (ComparisonConstraint & { position: number })[];
};

export function assembleProjectFromPacks(input: {
  name: string;
  brief: string;
  packIds: string[];
  extras: {
    label: string;
    metric: string;
    operator: string;
    value: number | string;
    unit: string | null;
    kind: "mandatory" | "preference";
    appliesTo: string[];
  }[];
}): AssembledProject | { error: string } {
  const packIds = [...new Set(input.packIds)];
  const unknownPack = packIds.find((id) => !PACK_MAP.has(id));

  if (unknownPack) {
    return { error: `Unknown constraint pack: ${unknownPack}.` };
  }

  const requirements = packIds.map((id) => {
    const option = PACK_MAP.get(id);
    return {
      text: option?.requirement.text ?? id,
      kind: option?.requirement.kind ?? "mandatory",
      status: "confirmed",
    };
  });

  const constraints: (ComparisonConstraint & { position: number })[] = [];
  const seenMetrics = new Set<string>();

  for (const id of packIds) {
    const option = PACK_MAP.get(id);
    for (const constraint of option?.constraints ?? []) {
      constraints.push({
        id: "",
        position: 0,
        label: constraint.label,
        metric: constraint.metric,
        operator: constraint.operator,
        value: constraint.value,
        unit: constraint.unit,
        kind: constraint.kind,
        appliesTo: [...constraint.appliesTo],
      });
      seenMetrics.add(`${constraint.metric}+${constraint.operator}`);
    }
  }

  for (const extra of input.extras) {
    const key = `${extra.metric}+${extra.operator}`;
    if (seenMetrics.has(key)) {
      continue;
    }

    const validated = parseConstraintValue(
      extra.metric,
      extra.operator,
      String(extra.value),
    );
    if ("error" in validated || typeof validated.value !== typeof extra.value) {
      if ("error" in validated) {
        return { error: `Suggestion "${extra.label}": ${validated.error}` };
      }
      continue;
    }

    const def = getMetricDef(extra.metric);
    if (!def) {
      return { error: `Suggestion "${extra.label}": unknown metric.` };
    }
    if (
      extra.appliesTo.some(
        (c) =>
          !CATALOG_CATEGORY_KEYS.includes(
            c as (typeof CATALOG_CATEGORY_KEYS)[number],
          ),
      )
    ) {
      return { error: `Suggestion "${extra.label}": unknown category.` };
    }

    constraints.push({
      id: "",
      position: 0,
      label: extra.label,
      metric: extra.metric,
      operator: extra.operator as ComparisonConstraint["operator"],
      value: extra.value,
      unit: extra.unit,
      kind: extra.kind,
      appliesTo: [...extra.appliesTo],
    });
    seenMetrics.add(key);
  }

  return { requirements, constraints };
}

