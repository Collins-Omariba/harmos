import type { CatalogPart, CatalogSpecs } from "@/lib/catalog/types";
import {
  readMetric,
  type CandidateScore,
  type CandidateStatus,
  type ComparisonConstraint,
  type ComparisonOperator,
  type ConstraintResult,
  type ConstraintValue,
} from "@/lib/comparison/types";

const EPSILON = 0.000001;

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (value !== 0 && Math.abs(value) < 0.001) {
    return value.toExponential(1);
  }
  return Number(value.toFixed(3)).toString();
}

function formatWithUnit(value: number, unit: string | null): string {
  if (!unit) {
    return formatNumber(value);
  }
  if (unit === "A") {
    if (value !== 0 && Math.abs(value) < 0.001) {
      return `${formatNumber(value * 1_000_000)} µA`;
    }
    if (Math.abs(value) < 1) {
      return `${formatNumber(value * 1_000)} mA`;
    }
    return `${formatNumber(value)} A`;
  }
  if (unit === "USD") {
    return `$${value.toFixed(2)}`;
  }
  if (unit === "C") {
    return `${formatNumber(value)} °C`;
  }
  return `${formatNumber(value)} ${unit}`;
}

export function formatConstraintValue(
  value: ConstraintValue,
  unit: string | null,
): string {
  return typeof value === "number"
    ? formatWithUnit(value, unit)
    : `"${value}"`;
}

export function formatExpected(
  operator: ComparisonOperator,
  value: ConstraintValue,
  unit: string | null,
): string {
  const formatted =
    typeof value === "number" ? formatWithUnit(value, unit) : `"${value}"`;

  switch (operator) {
    case "gte":
      return `≥ ${formatted}`;
    case "lte":
      return `≤ ${formatted}`;
    case "gt":
      return `> ${formatted}`;
    case "lt":
      return `< ${formatted}`;
    case "eq":
      return `= ${formatted}`;
    case "neq":
      return `≠ ${formatted}`;
    case "includes":
      return `includes ${formatted}`;
    case "covers":
      return `covers ${formatted}`;
  }
}

function formatActualValue(
  value: number | string | string[] | null,
  unit: string | null,
): string {
  if (value === null) {
    return "not specified";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "none";
  }
  if (typeof value === "number") {
    return formatWithUnit(value, unit);
  }
  return value;
}

function numericEquals(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(EPSILON, Math.abs(b) * EPSILON);
}

function missingResult(
  constraint: ComparisonConstraint,
  actual: string,
): ConstraintResult {
  return {
    constraintId: constraint.id,
    label: constraint.label,
    metric: constraint.metric,
    operator: constraint.operator,
    kind: constraint.kind,
    expected: formatExpected(
      constraint.operator,
      constraint.value,
      constraint.unit,
    ),
    actual,
    passed: false,
  };
}

export function evaluateConstraint(
  specs: CatalogSpecs,
  constraint: ComparisonConstraint,
): ConstraintResult {
  const base = {
    constraintId: constraint.id,
    label: constraint.label,
    metric: constraint.metric,
    operator: constraint.operator,
    kind: constraint.kind,
    expected: formatExpected(
      constraint.operator,
      constraint.value,
      constraint.unit,
    ),
  };

  if (constraint.operator === "covers") {
    const min = specs.supplyMinV;
    const max = specs.supplyMaxV;
    const expected = constraint.value;

    if (typeof expected !== "number" || min === undefined || max === undefined) {
      return missingResult(constraint, "not specified");
    }

    return {
      ...base,
      actual: `${formatNumber(min)}–${formatNumber(max)} ${constraint.unit ?? "V"}`,
      passed: min <= expected && expected <= max,
    };
  }

  const actual = readMetric(specs, constraint.metric);
  const display = formatActualValue(actual, constraint.unit);
  const expected = constraint.value;

  if (actual === null) {
    return { ...base, actual: display, passed: false };
  }

  if (constraint.operator === "includes") {
    if (Array.isArray(actual)) {
      return {
        ...base,
        actual: display,
        passed: actual.some(
          (item) =>
            typeof expected === "string" &&
            item.toLowerCase() === expected.toLowerCase(),
        ),
      };
    }

    return {
      ...base,
      actual: display,
      passed:
        typeof actual === "string" &&
        typeof expected === "string" &&
        actual.toLowerCase().includes(expected.toLowerCase()),
    };
  }

  if (constraint.operator === "eq" || constraint.operator === "neq") {
    let equal = false;

    if (typeof actual === "number" && typeof expected === "number") {
      equal = numericEquals(actual, expected);
    } else if (typeof actual === "string" && typeof expected === "string") {
      equal = actual.toLowerCase() === expected.toLowerCase();
    }

    return {
      ...base,
      actual: display,
      passed: constraint.operator === "eq" ? equal : !equal,
    };
  }

  if (typeof actual !== "number" || typeof expected !== "number") {
    return missingResult(constraint, display);
  }

  const passed =
    constraint.operator === "gte"
      ? actual >= expected
      : constraint.operator === "lte"
        ? actual <= expected
        : constraint.operator === "gt"
          ? actual > expected
          : actual < expected;

  return { ...base, actual: display, passed };
}

function statusFromCounts(
  mandatoryFailures: number,
  preferenceFailures: number,
): CandidateStatus {
  if (mandatoryFailures > 0) {
    return "fail";
  }
  if (preferenceFailures > 0) {
    return "review";
  }
  return "pass";
}

/**
 * Deterministic constraint scoring. This function must never call the model:
 * the same catalog row and constraints always produce the same result.
 */
export function scoreCandidate(
  part: CatalogPart,
  constraints: ComparisonConstraint[],
): CandidateScore {
  const results = constraints.map((constraint) =>
    evaluateConstraint(part.specs, constraint),
  );
  const mandatory = results.filter((result) => result.kind === "mandatory");
  const preferences = results.filter((result) => result.kind === "preference");
  const mandatoryPassed = mandatory.filter((result) => result.passed).length;
  const preferencePassed = preferences.filter((result) => result.passed).length;
  const mandatoryFailures = mandatory.length - mandatoryPassed;
  const preferenceFailures = preferences.length - preferencePassed;
  const totalWeight = mandatory.length * 2 + preferences.length;
  const passedWeight = mandatoryPassed * 2 + preferencePassed;
  const score =
    totalWeight === 0 ? 100 : Math.round((passedWeight / totalWeight) * 100);

  return {
    part,
    status: statusFromCounts(mandatoryFailures, preferenceFailures),
    score,
    mandatoryPassed,
    mandatoryTotal: mandatory.length,
    preferencePassed,
    preferenceTotal: preferences.length,
    results,
  };
}

const statusRank: Record<CandidateStatus, number> = {
  pass: 0,
  review: 1,
  fail: 2,
};

export function scoreCandidates(
  parts: CatalogPart[],
  constraints: ComparisonConstraint[],
): CandidateScore[] {
  return parts
    .map((part) => scoreCandidate(part, constraints))
    .sort((a, b) => {
      const rank = statusRank[a.status] - statusRank[b.status];
      if (rank !== 0) {
        return rank;
      }
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.part.partNumber.localeCompare(b.part.partNumber);
    });
}

export function countByStatus(scores: CandidateScore[]): Record<
  CandidateStatus,
  number
> {
  return scores.reduce(
    (counts, score) => {
      counts[score.status] += 1;
      return counts;
    },
    { pass: 0, review: 0, fail: 0 },
  );
}
