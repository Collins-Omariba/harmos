import type { CatalogPart, CatalogSpecs } from "@/lib/catalog/types";

export type ConstraintKind = "mandatory" | "preference";

export type ComparisonOperator =
  | "gte"
  | "lte"
  | "gt"
  | "lt"
  | "eq"
  | "neq"
  | "includes"
  | "covers";

export type ConstraintValue = number | string;

export type ComparisonConstraint = {
  id: string;
  label: string;
  metric: string;
  operator: ComparisonOperator;
  value: ConstraintValue;
  unit: string | null;
  kind: ConstraintKind;
  /**
   * Catalog categories this constraint applies to. Empty means all.
   * Non-applicable constraints are skipped (not failed) when scoring.
   */
  appliesTo: string[];
};

export type CandidateStatus = "pass" | "review" | "fail";

export type ConstraintResult = {
  constraintId: string;
  label: string;
  metric: string;
  operator: ComparisonOperator;
  kind: ConstraintKind;
  expected: string;
  actual: string;
  passed: boolean;
  /** True when the constraint does not apply to the part's category. */
  skipped: boolean;
};

export type CandidateScore = {
  part: CatalogPart;
  status: CandidateStatus;
  score: number;
  mandatoryPassed: number;
  mandatoryTotal: number;
  preferencePassed: number;
  preferenceTotal: number;
  skipped: number;
  results: ConstraintResult[];
};

export type CandidateExplanation = {
  verdict: string;
  reason: string;
};

export type ComparisonCandidatePayload = {
  part: CatalogPart;
  score: number;
  status: CandidateStatus;
  results: ConstraintResult[];
  explanation: CandidateExplanation | null;
};

export type ComparisonSummary = {
  summary: string;
  status: "deterministic" | "explained" | "explanation_unavailable";
};

export type ExplainComparisonRequirement = {
  text: string;
  kind: string;
  status: string;
};

export type ExplainComparisonCandidate = {
  partNumber: string;
  manufacturer: string;
  category: string;
  score: number;
  status: CandidateStatus;
  constraints: {
    label: string;
    kind: ConstraintKind;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
};

export type ExplainComparisonInput = {
  requirements: ExplainComparisonRequirement[];
  candidates: ExplainComparisonCandidate[];
};

export type CatalogMetricValue = number | string | string[] | null;

export function readMetric(
  specs: CatalogSpecs,
  metric: string,
): CatalogMetricValue {
  if (metric === "interfaces") {
    return specs.interfaces ?? null;
  }
  if (metric === "wireless") {
    return specs.wireless ?? null;
  }
  if (metric === "priceUsd") {
    return typeof specs.priceUsd === "number" ? specs.priceUsd : null;
  }

  const value = specs[metric as keyof CatalogSpecs];

  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value as string[];
  }
  return null;
}
