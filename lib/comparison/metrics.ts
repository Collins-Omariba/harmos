import type { ComparisonOperator } from "@/lib/comparison/types";

export type MetricValueType = "number" | "string";

export type MetricDef = {
  metric: string;
  label: string;
  valueType: MetricValueType;
  /** Unit suggestions for the editor; the stored unit is free text. */
  units: string[];
};

export const COMPARISON_OPERATORS: {
  value: ComparisonOperator;
  label: string;
  forType: MetricValueType | "both";
}[] = [
  { value: "gte", label: "≥ at least", forType: "number" },
  { value: "lte", label: "≤ at most", forType: "number" },
  { value: "gt", label: "> more than", forType: "number" },
  { value: "lt", label: "< less than", forType: "number" },
  { value: "eq", label: "= equals", forType: "both" },
  { value: "neq", label: "≠ not equals", forType: "number" },
  { value: "includes", label: "includes (list/text)", forType: "string" },
  { value: "covers", label: "supply range covers", forType: "number" },
];

/**
 * Every metric the scorer understands. The constraint editor only offers
 * these, so a stored constraint can never reference a metric that scores as
 * "not specified" by typo.
 */
export const COMPARISON_METRICS: MetricDef[] = [
  { metric: "supplyVoltageV", label: "Supply voltage (range covers)", valueType: "number", units: ["V"] },
  { metric: "rangeM", label: "Measurement range", valueType: "number", units: ["m"] },
  { metric: "minRangeM", label: "Minimum range", valueType: "number", units: ["m"] },
  { metric: "resolutionMm", label: "Resolution", valueType: "number", units: ["mm"] },
  { metric: "accuracyMm", label: "Accuracy", valueType: "number", units: ["mm"] },
  { metric: "operatingTempMinC", label: "Min operating temp", valueType: "number", units: ["C"] },
  { metric: "operatingTempMaxC", label: "Max operating temp", valueType: "number", units: ["C"] },
  { metric: "ipRating", label: "IP rating", valueType: "number", units: ["IP"] },
  { metric: "currentTypA", label: "Typical current", valueType: "number", units: ["A"] },
  { metric: "currentMaxA", label: "Max current", valueType: "number", units: ["A"] },
  { metric: "quiescentCurrentA", label: "Quiescent current", valueType: "number", units: ["A"] },
  { metric: "sleepCurrentA", label: "Sleep current", valueType: "number", units: ["A"] },
  { metric: "outputVoltageV", label: "Output voltage", valueType: "number", units: ["V"] },
  { metric: "outputCurrentMaxA", label: "Max output current", valueType: "number", units: ["A"] },
  { metric: "batteryCapacityMah", label: "Battery capacity", valueType: "number", units: ["mAh"] },
  { metric: "batteryNominalV", label: "Battery nominal voltage", valueType: "number", units: ["V"] },
  { metric: "adcBits", label: "ADC resolution", valueType: "number", units: ["bit"] },
  { metric: "channels", label: "Channel count", valueType: "number", units: ["ch"] },
  { metric: "sampleRateSps", label: "Sample rate", valueType: "number", units: ["SPS"] },
  { metric: "flashKb", label: "Flash size", valueType: "number", units: ["KB"] },
  { metric: "ramKb", label: "RAM size", valueType: "number", units: ["KB"] },
  { metric: "priceUsd", label: "Indicative price", valueType: "number", units: ["USD"] },
  { metric: "interfaces", label: "Interfaces (list)", valueType: "string", units: [] },
  { metric: "wireless", label: "Wireless (list)", valueType: "string", units: [] },
];

export function getMetricDef(metric: string): MetricDef | undefined {
  return COMPARISON_METRICS.find((def) => def.metric === metric);
}

export function operatorsForMetric(metric: string): ComparisonOperator[] {
  const def = getMetricDef(metric);
  return COMPARISON_OPERATORS.filter(
    (op) => op.forType === "both" || op.forType === (def?.valueType ?? "number"),
  ).map((op) => op.value);
}
