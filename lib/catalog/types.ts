/**
 * The catalog is a local, seeded set of real parts. Every part carries a
 * manufacturer datasheet URL and a product/source URL so comparison results
 * can be traced back to a public source.
 *
 * Future distributor integrations sit behind the same adapter interface in
 * lib/catalog/adapters/; the rest of the app never talks to a vendor SDK.
 */

export const CATALOG_CATEGORIES = [
  {
    key: "level-sensor",
    label: "Level sensors",
    description: "Ultrasonic, time-of-flight, LiDAR, and liquid-level sensors.",
  },
  {
    key: "mcu",
    label: "Microcontrollers",
    description: "Wi-Fi, Bluetooth, LoRa, and general-purpose MCUs and modules.",
  },
  {
    key: "ldo",
    label: "LDO regulators",
    description: "Low-dropout linear regulators for quiet, low-current rails.",
  },
  {
    key: "buck",
    label: "Buck converters",
    description: "Step-down switching regulators, including nano-quiescent parts.",
  },
  {
    key: "battery-charger",
    label: "Battery chargers",
    description: "Li-ion linear chargers, solar chargers, and harvesters.",
  },
  {
    key: "battery",
    label: "Battery cells",
    description: "18650, 21700, LiPo, and LiFePO4 cells.",
  },
  {
    key: "environmental-sensor",
    label: "Environmental sensors",
    description: "Temperature, humidity, pressure, and gas sensors.",
  },
  {
    key: "adc",
    label: "ADCs",
    description: "Delta-sigma and SAR analog-to-digital converters.",
  },
  {
    key: "rtc",
    label: "Real-time clocks",
    description: "Low-power RTCs for timestamped logging.",
  },
  {
    key: "fuel-gauge",
    label: "Fuel gauges",
    description: "Battery state-of-charge and voltage monitors.",
  },
  {
    key: "load-switch",
    label: "Load switches",
    description: "Power muxes, ideal diodes, and load switches.",
  },
  {
    key: "transceiver",
    label: "Transceivers",
    description: "RS-485 and bus transceivers for Modbus and field buses.",
  },
  {
    key: "cellular",
    label: "Cellular modules",
    description: "2G, LTE Cat-1/4, LTE-M, and NB-IoT modules.",
  },
  {
    key: "gnss",
    label: "GNSS modules",
    description: "GPS and multi-constellation positioning modules.",
  },
] as const;

export type CatalogCategoryKey = (typeof CATALOG_CATEGORIES)[number]["key"];

export const CATALOG_CATEGORY_KEYS = CATALOG_CATEGORIES.map(
  (category) => category.key,
);

export function isCatalogCategory(
  value: string,
): value is CatalogCategoryKey {
  return CATALOG_CATEGORY_KEYS.includes(value as CatalogCategoryKey);
}

export function catalogCategoryLabel(key: string): string {
  return CATALOG_CATEGORIES.find((category) => category.key === key)?.label ?? key;
}

/**
 * Structured, comparable facts transcribed from a manufacturer datasheet.
 * Numeric units are explicit in the key so scoring never guesses.
 */
export type CatalogSpecs = {
  supplyMinV?: number;
  supplyMaxV?: number;
  currentTypA?: number;
  currentMaxA?: number;
  quiescentCurrentA?: number;
  sleepCurrentA?: number;
  outputVoltageV?: number;
  outputCurrentMaxA?: number;
  operatingTempMinC?: number;
  operatingTempMaxC?: number;
  minRangeM?: number;
  rangeM?: number;
  resolutionMm?: number;
  accuracyMm?: number;
  batteryCapacityMah?: number;
  batteryNominalV?: number;
  adcBits?: number;
  channels?: number;
  sampleRateSps?: number;
  ipRating?: number;
  interfaces?: string[];
  wireless?: string[];
  cpu?: string;
  flashKb?: number;
  ramKb?: number;
  priceUsd?: number;
};

export type CatalogOrigin = "seeded" | "imported" | "custom";

export type CatalogPart = {
  id: string;
  partNumber: string;
  manufacturer: string;
  category: CatalogCategoryKey;
  description: string;
  package: string;
  datasheetUrl: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  priceUsd: number | null;
  origin: CatalogOrigin;
  tags: string[];
  specs: CatalogSpecs;
};

export type CatalogPartSeed = Omit<CatalogPart, "origin">;

export type CatalogFilter = {
  category?: string;
  categoryKeys?: string[];
  search?: string;
};

export type CatalogAdapter = {
  listParts(filter?: CatalogFilter): Promise<CatalogPart[]>;
  getPart(id: string): Promise<CatalogPart | null>;
  getPartsByIds(ids: string[]): Promise<CatalogPart[]>;
  listCategories(): Promise<
    { key: CatalogCategoryKey; label: string; description: string }[]
  >;
};
