import {
  CATALOG_CATEGORY_KEYS,
  isCatalogCategory,
} from "@/lib/catalog/types";
import { getMetricDef } from "@/lib/comparison/metrics";
import type {
  ComparisonOperator,
  ConstraintKind,
  ConstraintValue,
} from "@/lib/comparison/types";

/**
 * Universal constraint packs for project creation. Unlike the per-category
 * presets in presets.ts (kept for the seed demo), packs compose: a project
 * selects any number of options across dimensions — rails, buses, wireless,
 * power behavior, board role — and each option contributes requirement cards
 * plus deterministic constraints. Constraints carry appliesTo category lists
 * so a universal option never fails parts it does not concern.
 */

export type PackConstraint = {
  label: string;
  metric: string;
  operator: ComparisonOperator;
  value: ConstraintValue;
  unit: string | null;
  kind: ConstraintKind;
  appliesTo: string[];
};

export type ConstraintPack = {
  id: string;
  label: string;
  hint: string;
  requirement: {
    text: string;
    kind: "mandatory" | "preference" | "unknown";
  };
  constraints: PackConstraint[];
};

export type PackDimension = {
  key: string;
  label: string;
  description: string;
  options: ConstraintPack[];
};

const ALL_BUT_BATTERY = CATALOG_CATEGORY_KEYS.filter(
  (key) => key !== "battery",
);

function pack(
  id: string,
  label: string,
  hint: string,
  requirementText: string,
  requirementKind: "mandatory" | "preference" | "unknown",
  constraints: PackConstraint[],
): ConstraintPack {
  return { id, label, hint, requirement: { text: requirementText, kind: requirementKind }, constraints };
}

function at(
  label: string,
  metric: string,
  operator: ComparisonOperator,
  value: ConstraintValue,
  unit: string | null,
  kind: ConstraintKind,
  appliesTo: string[],
): PackConstraint {
  return { label, metric, operator, value, unit, kind, appliesTo };
}

export const PACK_DIMENSIONS: PackDimension[] = [
  {
    key: "supply",
    label: "Supply rails",
    description: "Voltage rails the design must run from.",
    options: [
      pack(
        "rail-3v3",
        "3.3 V logic rail",
        "Most MCUs, sensors, and logic run here.",
        "The board provides a 3.3 V logic rail.",
        "mandatory",
        [
          at("Runs from the 3.3 V rail", "supplyVoltageV", "covers", 3.3, "V", "mandatory", ALL_BUT_BATTERY),
        ],
      ),
      pack(
        "rail-5v",
        "5 V rail",
        "USB-powered sections and 5 V sensors.",
        "The board provides a 5 V rail.",
        "mandatory",
        [
          at("Runs from the 5 V rail", "supplyVoltageV", "covers", 5, "V", "mandatory", ALL_BUT_BATTERY),
        ],
      ),
      pack(
        "rail-12v",
        "12 V input",
        "Industrial and automotive front ends.",
        "The board accepts a 12 V input.",
        "mandatory",
        [
          at("Accepts a 12 V input", "supplyVoltageV", "covers", 12, "V", "mandatory", ["ldo", "buck"]),
        ],
      ),
      pack(
        "rail-liion",
        "Single-cell Li-ion (3.7 V)",
        "Battery-powered builds start here.",
        "The board runs from a single Li-ion cell.",
        "mandatory",
        [
          at("Accepts single-cell Li-ion (3.7 V)", "supplyVoltageV", "covers", 3.7, "V", "mandatory", ALL_BUT_BATTERY),
        ],
      ),
    ],
  },
  {
    key: "bus",
    label: "Wired buses",
    description: "Hardware interfaces parts must speak.",
    options: [
      pack(
        "bus-i2c",
        "I2C",
        "Sensors, RTCs, fuel gauges, ADCs.",
        "Parts communicate over I2C.",
        "mandatory",
        [
          at("Speaks I2C", "interfaces", "includes", "i2c", null, "mandatory", ["level-sensor", "mcu", "environmental-sensor", "adc", "rtc", "fuel-gauge", "gnss"]),
        ],
      ),
      pack(
        "bus-spi",
        "SPI",
        "Fast sensors, ADCs, displays.",
        "Parts communicate over SPI.",
        "mandatory",
        [
          at("Speaks SPI", "interfaces", "includes", "spi", null, "mandatory", ["level-sensor", "mcu", "environmental-sensor", "adc"]),
        ],
      ),
      pack(
        "bus-uart",
        "UART",
        "GPS, cellular, and debug consoles.",
        "Parts communicate over UART.",
        "mandatory",
        [
          at("Speaks UART", "interfaces", "includes", "uart", null, "mandatory", ["level-sensor", "mcu", "gnss", "cellular", "transceiver"]),
        ],
      ),
      pack(
        "bus-1wire",
        "1-Wire",
        "DS18B20-style temperature sensing.",
        "Temperature sensing uses 1-Wire.",
        "mandatory",
        [
          at("Speaks 1-Wire", "interfaces", "includes", "1-wire", null, "mandatory", ["environmental-sensor"]),
        ],
      ),
      pack(
        "bus-rs485",
        "RS-485 / Modbus RTU",
        "Industrial field-bus nodes.",
        "Field-bus nodes speak RS-485 (Modbus RTU).",
        "mandatory",
        [
          at("Speaks RS-485 (Modbus RTU)", "interfaces", "includes", "rs-485", null, "mandatory", ["transceiver"]),
        ],
      ),
    ],
  },
  {
    key: "wireless",
    label: "Wireless & positioning",
    description: "Radios and satellite positioning the product needs.",
    options: [
      pack(
        "wl-wifi",
        "Wi-Fi",
        "Reporting gateways and provisioning.",
        "The product connects over Wi-Fi.",
        "mandatory",
        [
          at("Connects over Wi-Fi", "wireless", "includes", "wifi", null, "mandatory", ["mcu"]),
        ],
      ),
      pack(
        "wl-ble",
        "Bluetooth LE",
        "Phone commissioning and beacons.",
        "The product uses Bluetooth LE.",
        "mandatory",
        [
          at("Uses Bluetooth LE", "wireless", "includes", "bluetooth", null, "mandatory", ["mcu"]),
        ],
      ),
      pack(
        "wl-lora",
        "LoRa",
        "Kilometre-range, low-rate links.",
        "The product links over LoRa.",
        "mandatory",
        [
          at("Links over LoRa", "wireless", "includes", "lora", null, "mandatory", ["mcu"]),
        ],
      ),
      pack(
        "wl-lte",
        "4G LTE",
        "Cellular backhaul (Cat-1/4, LTE-M, NB-IoT).",
        "The product connects over 4G LTE.",
        "mandatory",
        [
          at("Connects over LTE", "wireless", "includes", "lte", null, "mandatory", ["cellular"]),
        ],
      ),
      pack(
        "wl-2g",
        "2G fallback",
        "Coverage where LTE is absent.",
        "The product falls back to 2G where LTE is absent.",
        "mandatory",
        [
          at("Supports 2G fallback", "wireless", "includes", "gsm", null, "mandatory", ["cellular"]),
        ],
      ),
      pack(
        "wl-gnss",
        "GPS / GNSS",
        "Position fixes over UART NMEA.",
        "The product takes satellite position fixes.",
        "mandatory",
        [
          at("Outputs position over UART", "interfaces", "includes", "uart", null, "mandatory", ["gnss"]),
        ],
      ),
    ],
  },
  {
    key: "power",
    label: "Power behavior",
    description: "How the design sips or harvests power.",
    options: [
      pack(
        "pw-battery",
        "Battery backup",
        "Must survive on a cell.",
        "The design must survive on battery backup.",
        "mandatory",
        [
          at("Sleep current at or below 50 µA", "sleepCurrentA", "lte", 0.00005, "A", "preference", ["mcu", "rtc", "environmental-sensor", "gnss"]),
          at("Quiescent current at or below 10 µA", "quiescentCurrentA", "lte", 0.00001, "A", "preference", ["ldo", "buck", "load-switch", "battery-charger"]),
        ],
      ),
      pack(
        "pw-solar",
        "Solar harvesting",
        "Small-cell energy input.",
        "The design harvests energy from a small solar cell.",
        "mandatory",
        [
          at("Starts from a 1 V or lower input", "supplyMinV", "lte", 1, "V", "preference", ["battery-charger"]),
        ],
      ),
    ],
  },
  {
    key: "role",
    label: "Board role",
    description: "What this board is. Recorded as requirements, not scored.",
    options: [
      pack(
        "role-iot",
        "IoT board with MCU",
        "Application board: MCU plus radio.",
        "Board role: IoT application board with MCU and radio.",
        "preference",
        [],
      ),
      pack(
        "role-power",
        "Power board",
        "Regulation and distribution stage.",
        "Board role: power regulation and distribution.",
        "preference",
        [],
      ),
      pack(
        "role-sensor",
        "Sensor board",
        "Front end for sensing elements.",
        "Board role: sensor front end.",
        "preference",
        [],
      ),
    ],
  },
];

export const PACK_MAP: Map<string, ConstraintPack> = new Map(
  PACK_DIMENSIONS.flatMap((dimension) =>
    dimension.options.map(
      (option) => [option.id, option] as [string, ConstraintPack],
    ),
  ),
);

export function getPack(id: string): ConstraintPack | undefined {
  return PACK_MAP.get(id);
}

function metricKnown(metric: string): boolean {
  return getMetricDef(metric) !== undefined;
}

export function validatePackConstraints(): string[] {
  const problems: string[] = [];

  for (const option of PACK_MAP.values()) {
    for (const constraint of option.constraints) {
      if (!metricKnown(constraint.metric)) {
        problems.push(`${option.id}: unknown metric ${constraint.metric}`);
      }
      for (const category of constraint.appliesTo) {
        if (!isCatalogCategory(category)) {
          problems.push(`${option.id}: unknown category ${category}`);
        }
      }
    }
  }

  return problems;
}
