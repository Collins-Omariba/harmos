import type {
  CandidateStatus,
  ComparisonCandidatePayload,
  ComparisonConstraint,
  ComparisonOperator,
  ConstraintValue,
} from "@/lib/comparison/types";
import {
  COMPARISON_METRICS,
  getMetricDef,
  operatorsForMetric,
} from "@/lib/comparison/metrics";
import { CATALOG_CATEGORY_KEYS } from "@/lib/catalog/types";

type ConstraintRow = {
  id: string;
  label: string;
  metric: string;
  operator: string;
  valueJson: string;
  unit: string | null;
  kind: string;
  appliesToJson?: string | null;
};

const OPERATORS: ComparisonOperator[] = [
  "gte",
  "lte",
  "gt",
  "lt",
  "eq",
  "neq",
  "includes",
  "covers",
];

const VALID_OPERATORS = new Set<string>(OPERATORS);

export function parseConstraintValue(
  metric: string,
  operator: string,
  rawValue: string,
): { value: number | string } | { error: string } {
  const def = getMetricDef(metric);

  if (!def) {
    return {
      error: `Unknown metric. Choose one of: ${COMPARISON_METRICS.map((m) => m.metric).join(", ")}.`,
    };
  }
  if (!VALID_OPERATORS.has(operator)) {
    return { error: "Unknown operator." };
  }
  if (
    !(operatorsForMetric(metric) as string[]).includes(operator) &&
    !(operator === "eq" && def.valueType === "string")
  ) {
    return { error: `Operator does not apply to ${def.label}.` };
  }

  if (def.valueType === "number") {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return { error: `"${rawValue}" is not a number.` };
    }
    return { value };
  }

  return { value: rawValue };
}

export function decodeConstraintValue(raw: string): ConstraintValue {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "number" || typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // Older or hand-edited rows may hold a bare value.
  }

  return raw;
}

export function encodeConstraintValue(value: ConstraintValue): string {
  return JSON.stringify(value);
}

export function toDomainConstraint(row: ConstraintRow): ComparisonConstraint {
  return {
    id: row.id,
    label: row.label,
    metric: row.metric,
    operator: OPERATORS.includes(row.operator as ComparisonOperator)
      ? (row.operator as ComparisonOperator)
      : "eq",
    value: decodeConstraintValue(row.valueJson),
    unit: row.unit,
    kind: row.kind === "preference" ? "preference" : "mandatory",
    appliesTo: parseAppliesTo(row.appliesToJson),
  };
}

export function parseAppliesTo(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export function parseAppliesToList(values: string[]): string[] {
  return [...new Set(values)].filter((category) =>
    (CATALOG_CATEGORY_KEYS as readonly string[]).includes(category),
  );
}

export const KNOWN_CATEGORY_COUNT = CATALOG_CATEGORY_KEYS.length;

export function parseConstraintSnapshot(
  raw: string,
): ComparisonConstraint[] {
  try {
    const value: unknown = JSON.parse(raw);

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(
        (constraint): constraint is ComparisonConstraint =>
          Boolean(
            constraint &&
              typeof constraint === "object" &&
              "id" in constraint &&
              "label" in constraint &&
              "metric" in constraint &&
              "operator" in constraint &&
              "value" in constraint &&
              "kind" in constraint,
          ),
      )
      .map((constraint) => ({
        ...constraint,
        unit: constraint.unit ?? null,
        kind: constraint.kind === "preference" ? "preference" : "mandatory",
        appliesTo: Array.isArray(constraint.appliesTo)
          ? constraint.appliesTo.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
      }));
  } catch {
    return [];
  }
}

export function parseCandidatePayload(
  raw: string,
): ComparisonCandidatePayload | null {
  try {
    const value: unknown = JSON.parse(raw);

    if (
      !value ||
      typeof value !== "object" ||
      !("part" in value) ||
      !("results" in value) ||
      !Array.isArray(value.results)
    ) {
      return null;
    }

    const payload = value as ComparisonCandidatePayload;
    const status: CandidateStatus =
      payload.status === "pass" ||
      payload.status === "review" ||
      payload.status === "fail"
        ? payload.status
        : "fail";

    return {
      ...payload,
      status,
      explanation: payload.explanation ?? null,
    };
  } catch {
    return null;
  }
}
