import type { ComparisonOperator } from "@/lib/comparison/types";

export type MetricValueType = "number" | "string";

export type MetricDef = {
  metric: string;
  label: string;
  valueType: MetricValueType;
  /** Unit suggestions for the editor; the stored unit is free text. */
  units: string[];
  /** Plain-language guidance shown behind the field's info icon. */
  help: string;
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
  { metric: "supplyVoltageV", label: "Supply voltage (range covers)", valueType: "number", units: ["V"], help: "A rail voltage the part must run from. Scored from the min/max supply below — you never enter this directly." },
  { metric: "supplyMinV", label: "Minimum supply voltage", valueType: "number", units: ["V"], help: "Lowest input voltage the part runs from. Look for “Supply Voltage Range” or “Operating Range” in the datasheet." },
  { metric: "supplyMaxV", label: "Maximum supply voltage", valueType: "number", units: ["V"], help: "Highest safe input voltage. Use the operating maximum, not the absolute-maximum rating." },
  { metric: "rangeM", label: "Measurement range", valueType: "number", units: ["m"], help: "Farthest distance the sensor reports reliably, in metres." },
  { metric: "minRangeM", label: "Minimum range", valueType: "number", units: ["m"], help: "Nearest distance the sensor reports reliably — inside this it reads garbage or nothing." },
  { metric: "resolutionMm", label: "Resolution", valueType: "number", units: ["mm"], help: "Smallest distance change the sensor can report. Finer is better; this is not the same as accuracy." },
  { metric: "accuracyMm", label: "Accuracy", valueType: "number", units: ["mm"], help: "Worst-case measurement error versus truth, usually given as ±mm." },
  { metric: "operatingTempMinC", label: "Min operating temp", valueType: "number", units: ["C"], help: "Coldest ambient temperature the part is rated for, from the “Operating Temperature Range” row." },
  { metric: "operatingTempMaxC", label: "Max operating temp", valueType: "number", units: ["C"], help: "Hottest ambient temperature the part is rated for." },
  { metric: "ipRating", label: "IP rating", valueType: "number", units: ["IP"], help: "Ingress protection as a plain number — enter 65 for IP65, 67 for IP67." },
  { metric: "currentTypA", label: "Typical current", valueType: "number", units: ["A"], help: "Normal running draw in amps (0.0034 = 3.4 mA). Take the “Supply Current, typical” row." },
  { metric: "currentMaxA", label: "Max current", valueType: "number", units: ["A"], help: "Highest continuous draw the part tolerates, or most a switch can carry. Use the Maximum column, not peak pulses." },
  { metric: "quiescentCurrentA", label: "Quiescent current", valueType: "number", units: ["A"], help: "Current the regulator or converter itself burns with no load — the “Iq” row. Lower means longer battery life." },
  { metric: "sleepCurrentA", label: "Sleep current", valueType: "number", units: ["A"], help: "Draw in the deepest sleep or shutdown mode — “Shutdown Current” or “Standby Current”." },
  { metric: "outputVoltageV", label: "Output voltage", valueType: "number", units: ["V"], help: "Regulated output voltage. For adjustable parts enter the nominal setting you plan to use." },
  { metric: "outputCurrentMaxA", label: "Max output current", valueType: "number", units: ["A"], help: "Most current the output can deliver continuously — the “Output Current” maximum." },
  { metric: "batteryCapacityMah", label: "Battery capacity", valueType: "number", units: ["mAh"], help: "Rated charge in milliamp-hours — the “Nominal Capacity” row at the stated discharge rate." },
  { metric: "batteryNominalV", label: "Battery nominal voltage", valueType: "number", units: ["V"], help: "Mid-discharge voltage, e.g. 3.6–3.7 V per Li-ion cell." },
  { metric: "adcBits", label: "ADC resolution", valueType: "number", units: ["bit"], help: "Converter resolution in bits. Prefer the effective (ENOB) figure if the datasheet gives one." },
  { metric: "channels", label: "Channel count", valueType: "number", units: ["ch"], help: "Number of analog input channels." },
  { metric: "sampleRateSps", label: "Sample rate", valueType: "number", units: ["SPS"], help: "Fastest reliable conversion rate in samples per second." },
  { metric: "flashKb", label: "Flash size", valueType: "number", units: ["KB"], help: "Program flash in kilobytes." },
  { metric: "ramKb", label: "RAM size", valueType: "number", units: ["KB"], help: "Working RAM in kilobytes." },
  { metric: "cpu", label: "CPU core", valueType: "string", units: [], help: "Core name as printed, e.g. Xtensa LX7, Cortex-M4, RISC-V." },
  { metric: "priceUsd", label: "Indicative price", valueType: "number", units: ["USD"], help: "Single-unit estimate, not a live quote. Entered in the price field above, not here." },
  { metric: "interfaces", label: "Interfaces (list)", valueType: "string", units: [], help: "Wired buses the part speaks, comma separated: i2c, spi, uart, analog, pwm, rs-485." },
  { metric: "wireless", label: "Wireless (list)", valueType: "string", units: [], help: "Radios on board, comma separated: wifi, bluetooth, lora, lte, nb-iot." },
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
