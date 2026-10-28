import type { CatalogCategoryKey } from "@/lib/catalog/types";
import type {
  ComparisonConstraint,
  ComparisonOperator,
  ConstraintKind,
  ConstraintValue,
} from "@/lib/comparison/types";

export type PresetConstraint = {
  label: string;
  metric: string;
  operator: ComparisonOperator;
  value: ConstraintValue;
  unit: string | null;
  kind: ConstraintKind;
};

export type ComparisonPreset = {
  key: CatalogCategoryKey;
  name: string;
  description: string;
  constraints: PresetConstraint[];
};

function constraint(
  label: string,
  metric: string,
  operator: ComparisonOperator,
  value: ConstraintValue,
  unit: string | null,
  kind: ConstraintKind,
): PresetConstraint {
  return { label, metric, operator, value, unit, kind };
}

export const COMPARISON_PRESETS: ComparisonPreset[] = [
  {
    key: "level-sensor",
    name: "Tank level sensor",
    description:
      "Compare ultrasonic, time-of-flight, and liquid-level sensors against a 3.3 V rail, a 2 m measurement span, and outdoor protection.",
    constraints: [
      constraint(
        "Runs from the 3.3 V rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Measures at least 2 m",
        "rangeM",
        "gte",
        2,
        "m",
        "mandatory",
      ),
      constraint(
        "Rated down to 0 °C",
        "operatingTempMinC",
        "lte",
        0,
        "C",
        "mandatory",
      ),
      constraint(
        "Ingress protection of IP65 or better",
        "ipRating",
        "gte",
        65,
        "IP",
        "mandatory",
      ),
      constraint(
        "Resolution of 10 mm or better",
        "resolutionMm",
        "lte",
        10,
        "mm",
        "preference",
      ),
      constraint(
        "Has an I2C interface",
        "interfaces",
        "includes",
        "i2c",
        null,
        "preference",
      ),
      constraint(
        "Prototype price at or below $120",
        "priceUsd",
        "lte",
        120,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "mcu",
    name: "Wi-Fi microcontroller",
    description:
      "Compare Wi-Fi and Bluetooth modules against a 3.3 V rail, sleep current, flash, and cost.",
    constraints: [
      constraint(
        "Runs from the 3.3 V rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Includes Wi-Fi",
        "wireless",
        "includes",
        "wifi",
        null,
        "mandatory",
      ),
      constraint(
        "Rated down to -20 °C",
        "operatingTempMinC",
        "lte",
        -20,
        "C",
        "mandatory",
      ),
      constraint(
        "Sleep current at or below 50 µA",
        "sleepCurrentA",
        "lte",
        0.00005,
        "A",
        "preference",
      ),
      constraint(
        "At least 1 MB of flash",
        "flashKb",
        "gte",
        1024,
        "KB",
        "preference",
      ),
      constraint(
        "Price at or below $15",
        "priceUsd",
        "lte",
        15,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "ldo",
    name: "3.3 V LDO",
    description:
      "Compare low-dropout regulators for a 3.7 V Li-ion input and a 250 mA 3.3 V rail.",
    constraints: [
      constraint(
        "Accepts a 3.7 V Li-ion input",
        "supplyVoltageV",
        "covers",
        3.7,
        "V",
        "mandatory",
      ),
      constraint(
        "Regulates to 3.3 V",
        "outputVoltageV",
        "eq",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Delivers at least 250 mA",
        "outputCurrentMaxA",
        "gte",
        0.25,
        "A",
        "mandatory",
      ),
      constraint(
        "Quiescent current at or below 10 µA",
        "quiescentCurrentA",
        "lte",
        0.00001,
        "A",
        "preference",
      ),
      constraint(
        "Price at or below $2",
        "priceUsd",
        "lte",
        2,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "buck",
    name: "3.3 V buck converter",
    description:
      "Compare step-down converters for a 3.7 V Li-ion input and a 300 mA 3.3 V rail.",
    constraints: [
      constraint(
        "Accepts a 3.7 V Li-ion input",
        "supplyVoltageV",
        "covers",
        3.7,
        "V",
        "mandatory",
      ),
      constraint(
        "Regulates to 3.3 V",
        "outputVoltageV",
        "eq",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Delivers at least 300 mA",
        "outputCurrentMaxA",
        "gte",
        0.3,
        "A",
        "mandatory",
      ),
      constraint(
        "Quiescent current at or below 5 µA",
        "quiescentCurrentA",
        "lte",
        0.000005,
        "A",
        "preference",
      ),
      constraint(
        "Price at or below $3",
        "priceUsd",
        "lte",
        3,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "battery-charger",
    name: "Li-ion charger",
    description:
      "Compare single-cell Li-ion chargers for a 5 V input and at least 250 mA of charge current.",
    constraints: [
      constraint(
        "Accepts a 5 V input",
        "supplyVoltageV",
        "covers",
        5,
        "V",
        "mandatory",
      ),
      constraint(
        "Charges at 250 mA or more",
        "outputCurrentMaxA",
        "gte",
        0.25,
        "A",
        "mandatory",
      ),
      constraint(
        "Quiescent current at or below 100 µA",
        "quiescentCurrentA",
        "lte",
        0.0001,
        "A",
        "preference",
      ),
      constraint(
        "Price at or below $5",
        "priceUsd",
        "lte",
        5,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "battery",
    name: "18650 battery cell",
    description:
      "Compare Li-ion cells for at least 2500 mAh, a 3.6 V nominal voltage, and a 1 A continuous load.",
    constraints: [
      constraint(
        "Nominal voltage of 3.6 V",
        "batteryNominalV",
        "eq",
        3.6,
        "V",
        "mandatory",
      ),
      constraint(
        "Capacity of at least 2500 mAh",
        "batteryCapacityMah",
        "gte",
        2500,
        "mAh",
        "mandatory",
      ),
      constraint(
        "Continuous discharge of at least 1 A",
        "currentMaxA",
        "gte",
        1,
        "A",
        "mandatory",
      ),
      constraint(
        "Rated up to 50 °C",
        "operatingTempMaxC",
        "gte",
        50,
        "C",
        "preference",
      ),
      constraint(
        "Price at or below $10",
        "priceUsd",
        "lte",
        10,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "environmental-sensor",
    name: "Environmental sensor",
    description:
      "Compare temperature, humidity, and pressure sensors for a 3.3 V I2C bus.",
    constraints: [
      constraint(
        "Runs from the 3.3 V rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Has an I2C interface",
        "interfaces",
        "includes",
        "i2c",
        null,
        "mandatory",
      ),
      constraint(
        "Rated down to -20 °C",
        "operatingTempMinC",
        "lte",
        -20,
        "C",
        "preference",
      ),
      constraint(
        "Price at or below $10",
        "priceUsd",
        "lte",
        10,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "adc",
    name: "ADC",
    description:
      "Compare analog-to-digital converters for a 3.3 V rail and at least 16 bits.",
    constraints: [
      constraint(
        "Runs from the 3.3 V rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "At least 16-bit resolution",
        "adcBits",
        "gte",
        16,
        "bit",
        "mandatory",
      ),
      constraint(
        "Has an I2C interface",
        "interfaces",
        "includes",
        "i2c",
        null,
        "preference",
      ),
      constraint(
        "Sample rate of at least 100 SPS",
        "sampleRateSps",
        "gte",
        100,
        "SPS",
        "preference",
      ),
      constraint(
        "Price at or below $10",
        "priceUsd",
        "lte",
        10,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "rtc",
    name: "Real-time clock",
    description:
      "Compare low-power I2C real-time clocks for a 3.3 V rail.",
    constraints: [
      constraint(
        "Runs from the 3.3 V rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Has an I2C interface",
        "interfaces",
        "includes",
        "i2c",
        null,
        "mandatory",
      ),
      constraint(
        "Draws at or below 10 µA",
        "currentTypA",
        "lte",
        0.00001,
        "A",
        "preference",
      ),
      constraint(
        "Price at or below $5",
        "priceUsd",
        "lte",
        5,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "fuel-gauge",
    name: "Battery fuel gauge",
    description:
      "Compare I2C Li-ion fuel gauges for a single-cell battery.",
    constraints: [
      constraint(
        "Runs from a single Li-ion cell",
        "supplyVoltageV",
        "covers",
        3.7,
        "V",
        "mandatory",
      ),
      constraint(
        "Has an I2C interface",
        "interfaces",
        "includes",
        "i2c",
        null,
        "mandatory",
      ),
      constraint(
        "Draws at or below 100 µA",
        "currentTypA",
        "lte",
        0.0001,
        "A",
        "preference",
      ),
      constraint(
        "Price at or below $5",
        "priceUsd",
        "lte",
        5,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "load-switch",
    name: "Load switch",
    description:
      "Compare load switches and power muxes for a 3.3 V rail carrying at least 500 mA.",
    constraints: [
      constraint(
        "Runs from the 3.3 V rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Carries at least 500 mA",
        "currentMaxA",
        "gte",
        0.5,
        "A",
        "mandatory",
      ),
      constraint(
        "Quiescent current at or below 50 µA",
        "quiescentCurrentA",
        "lte",
        0.00005,
        "A",
        "preference",
      ),
      constraint(
        "Price at or below $3",
        "priceUsd",
        "lte",
        3,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "transceiver",
    name: "RS-485 transceiver",
    description:
      "Compare RS-485 transceivers for a 3.3 V logic side and a Modbus bus.",
    constraints: [
      constraint(
        "Runs from the 3.3 V logic rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "Speaks RS-485 (Modbus RTU)",
        "interfaces",
        "includes",
        "rs-485",
        null,
        "mandatory",
      ),
      constraint(
        "UART-side interface",
        "interfaces",
        "includes",
        "uart",
        null,
        "mandatory",
      ),
      constraint(
        "Price at or below $8",
        "priceUsd",
        "lte",
        8,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "cellular",
    name: "Cellular module",
    description:
      "Compare cellular modules for a 3.8 V battery rail and LTE connectivity.",
    constraints: [
      constraint(
        "Accepts a 3.8 V battery rail",
        "supplyVoltageV",
        "covers",
        3.8,
        "V",
        "mandatory",
      ),
      constraint(
        "LTE connectivity",
        "wireless",
        "includes",
        "lte",
        null,
        "mandatory",
      ),
      constraint(
        "UART control interface",
        "interfaces",
        "includes",
        "uart",
        null,
        "preference",
      ),
      constraint(
        "Price at or below $30",
        "priceUsd",
        "lte",
        30,
        "USD",
        "preference",
      ),
    ],
  },
  {
    key: "gnss",
    name: "GNSS module",
    description:
      "Compare positioning modules for a 3.3 V rail and UART NMEA output.",
    constraints: [
      constraint(
        "Runs from the 3.3 V rail",
        "supplyVoltageV",
        "covers",
        3.3,
        "V",
        "mandatory",
      ),
      constraint(
        "NMEA output over UART",
        "interfaces",
        "includes",
        "uart",
        null,
        "mandatory",
      ),
      constraint(
        "I2C auxiliary interface",
        "interfaces",
        "includes",
        "i2c",
        null,
        "preference",
      ),
      constraint(
        "Price at or below $25",
        "priceUsd",
        "lte",
        25,
        "USD",
        "preference",
      ),
    ],
  },
];

export function getComparisonPreset(
  key: string,
): ComparisonPreset | undefined {
  return COMPARISON_PRESETS.find((preset) => preset.key === key);
}

export function requirementsFromPreset(preset: ComparisonPreset) {
  return preset.constraints.map((constraint) => ({
    text: constraint.label,
    kind: constraint.kind,
    status: "confirmed",
  }));
}

export function constraintsFromPreset(
  preset: ComparisonPreset,
  projectId: string,
): (ComparisonConstraint & { projectId: string; position: number })[] {
  return preset.constraints.map((constraint, index) => ({
    id: `${projectId}-constraint-${String(index + 1).padStart(2, "0")}`,
    projectId,
    position: index,
    label: constraint.label,
    metric: constraint.metric,
    operator: constraint.operator,
    value: constraint.value,
    unit: constraint.unit,
    kind: constraint.kind,
    appliesTo: [],
  }));
}
