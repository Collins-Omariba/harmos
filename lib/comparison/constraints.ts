import type {
  CandidateStatus,
  ComparisonCandidatePayload,
  ComparisonConstraint,
  ComparisonOperator,
  ConstraintValue,
} from "@/lib/comparison/types";

type ConstraintRow = {
  id: string;
  label: string;
  metric: string;
  operator: string;
  valueJson: string;
  unit: string | null;
  kind: string;
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
  };
}

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
