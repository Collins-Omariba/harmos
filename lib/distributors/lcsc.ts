/**
 * LCSC distributor client.
 *
 * Two transports, in order of preference:
 *
 * 1. Official API (per the "LCSC API Access & Usage Guide" at
 *    https://www.lcsc.com/docs/index.html → downloadable guide) when
 *    LCSC_API_KEY / LCSC_API_SECRET are set. Signed GETs to
 *    https://api.lcsc.com (override with LCSC_API_BASE_URL).
 * 2. Public community fallback (https://lcsc.com/api/products/search, the
 *    endpoint community tools use) when no keys are configured. Best-effort:
 *    no category tree, no spec parameters, unverified currency — and
 *    throttled to one request per 2 seconds.
 *
 * Server-only: reads secrets from the environment, never import from client
 * components.
 */

import { createHash, randomBytes } from "node:crypto";

import type {
  DistributorParameter,
  DistributorPart,
  DistributorPriceBreak,
} from "@/lib/distributors/types";
import { DistributorError } from "@/lib/distributors/types";

export const LCSC_BASE_URL =
  process.env.LCSC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.lcsc.com";

const LCSC_PRODUCT_CODE = /^C\d+$/i;

export type LcscCredentials = { key: string; secret: string };

/** Null when no keys are configured — callers fall back to public search. */
export function getCredentials(): LcscCredentials | null {
  const key = process.env.LCSC_API_KEY?.trim();
  const secret = process.env.LCSC_API_SECRET?.trim();
  if (!key || !secret) return null;
  return { key, secret };
}

export function normalizeLcscCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (!LCSC_PRODUCT_CODE.test(code)) {
    throw new DistributorError(
      "lcsc",
      "not-found",
      `"${raw.trim()}" is not an LCSC product code — it looks like C followed by digits (e.g. C25804).`,
    );
  }
  return code;
}

/** 16-char lowercase-alphanumeric nonce, per the usage guide. */
export function lcscNonce(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...randomBytes(16)].map((b) => alphabet[b % alphabet.length]).join("");
}

function encodeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return `[${value.map(encodeValue).join(",")}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${JSON.stringify(k)}:${encodeValue(v)}`)
      .sort();
    return `{${entries.join(",")}}`;
  }
  return String(value);
}

/** Python urllib quote_plus: spaces become `+`, `!'()*` stay escaped. */
export function quotePlus(raw: string): string {
  return encodeURIComponent(raw)
    .replace(/%20/g, "+")
    .replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

/**
 * Build the signed auth headers. Exported for tests; prefer the client
 * functions below in app code.
 */
export function lcscAuthHeaders(
  key: string,
  secret: string,
  params: Record<string, string | number | boolean | undefined>,
  opts?: { nonce?: string; timestamp?: number },
): Record<string, string> {
  const nonce = opts?.nonce ?? lcscNonce();
  const timestamp = String(opts?.timestamp ?? Math.floor(Date.now() / 1000));

  const query = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([k, v]) => [k, encodeValue(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${quotePlus(k)}=${quotePlus(v)}`)
    .join("&");

  const signBase =
    `key=${key}&nonce=${nonce}&secret=${secret}&timestamp=${timestamp}` +
    (query ? `&${query}` : "");
  const signature = createHash("sha256").update(signBase, "utf-8").digest("hex");

  return { key, nonce, timestamp, signature };
}

type LcscApiEnvelope = {
  success: boolean;
  code: number;
  message: string;
  result: unknown;
};

function throwForCode(code: number, message: string): never {
  if (code === 429 || code === 430) {
    throw new DistributorError(
      "lcsc",
      "rate-limit",
      "LCSC rate limit reached — wait a minute and try again.",
    );
  }
  if (code >= 4001 && code <= 4006) {
    throw new DistributorError(
      "lcsc",
      "auth",
      `LCSC rejected the API credentials (${message || `code ${code}`}). Check LCSC_API_KEY / LCSC_API_SECRET.`,
    );
  }
  throw new DistributorError(
    "lcsc",
    "bad-response",
    message ? `LCSC error: ${message}` : `LCSC error (code ${code}).`,
  );
}

async function lcscGet(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  creds: LcscCredentials,
): Promise<unknown> {
  const headers = lcscAuthHeaders(creds.key, creds.secret, params);
  const query = Object.entries(params)
    .flatMap(([k, v]) => (v === undefined ? [] : [`${quotePlus(k)}=${quotePlus(String(v))}`]))
    .join("&");

  let response: Response;
  try {
    response = await fetch(`${LCSC_BASE_URL}${path}?${query}`, { headers });
  } catch (error) {
    throw new DistributorError(
      "lcsc",
      "network",
      `Could not reach the LCSC API (${error instanceof Error ? error.message : "network error"}).`,
    );
  }

  let envelope: LcscApiEnvelope;
  try {
    envelope = (await response.json()) as LcscApiEnvelope;
  } catch {
    throw new DistributorError(
      "lcsc",
      "bad-response",
      `LCSC returned an unreadable response (HTTP ${response.status}).`,
    );
  }

  if (!envelope.success || envelope.code !== 200) {
    throwForCode(envelope.code, envelope.message);
  }
  return envelope.result;
}

type LcscProduct = {
  lcscProductNumber?: string;
  manufacturerProductNumber?: string;
  manufacturer?: { name?: string };
  description?: string;
  productDetailURL?: string;
  datasheetURL?: string;
  productPhotoURL?: string[];
  category?: {
    firstCatalogName?: string;
    secondCatalogName?: string;
    thirdCatalogName?: string;
    forthCatalogName?: string;
  };
  package?: string;
  isInStock?: boolean;
  quantityAvailable?: number | string;
  minimumOrderQuantity?: number;
  productParameters?: { paramName?: string; paramValue?: string }[];
  productPrice?: {
    currency?: string;
    standardPricing?: { breakQuantity?: number; unitPrice?: number }[];
  };
};

function asPart(raw: LcscProduct): DistributorPart {
  const category = raw.category ?? {};
  const categoryPath = [
    category.firstCatalogName,
    category.secondCatalogName,
    category.thirdCatalogName,
    category.forthCatalogName,
  ].filter((name): name is string => Boolean(name));

  const parameters: DistributorParameter[] = (raw.productParameters ?? [])
    .filter((p) => p.paramName)
    .map((p) => ({
      name: String(p.paramName),
      value: String(p.paramValue ?? ""),
    }));

  const priceBreaks: DistributorPriceBreak[] = (
    raw.productPrice?.standardPricing ?? []
  )
    .filter(
      (b): b is { breakQuantity: number; unitPrice: number } =>
        typeof b.breakQuantity === "number" &&
        typeof b.unitPrice === "number",
    )
    .map((b) => ({ breakQuantity: b.breakQuantity, unitPrice: b.unitPrice }))
    .sort((a, b) => a.breakQuantity - b.breakQuantity);

  const stock =
    typeof raw.quantityAvailable === "number"
      ? raw.quantityAvailable
      : typeof raw.quantityAvailable === "string" && raw.quantityAvailable !== ""
        ? Number(raw.quantityAvailable)
        : null;

  return {
    distributor: "lcsc",
    productCode: String(raw.lcscProductNumber ?? ""),
    mpn: String(raw.manufacturerProductNumber ?? ""),
    manufacturer: String(raw.manufacturer?.name ?? ""),
    description: String(raw.description ?? ""),
    categoryPath,
    packageName: String(raw.package ?? ""),
    datasheetUrl: raw.datasheetURL?.trim() ? String(raw.datasheetURL) : null,
    sourceUrl: String(raw.productDetailURL ?? ""),
    imageUrls: (raw.productPhotoURL ?? []).filter((u) => typeof u === "string"),
    parameters,
    priceBreaks,
    currency: String(raw.productPrice?.currency ?? "USD"),
    inStock: raw.isInStock ?? false,
    stockAvailable: Number.isFinite(stock) ? (stock as number) : null,
    minimumOrderQuantity:
      typeof raw.minimumOrderQuantity === "number"
        ? raw.minimumOrderQuantity
        : null,
  };
}

/** Minimum gap between public-search requests (community-endpoint courtesy). */
export const PUBLIC_LCSC_MIN_INTERVAL_MS = 2000;

const PUBLIC_LCSC_SEARCH_URL = "https://www.lcsc.com/api/products/search";
const PUBLIC_LCSC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let publicLcscQueue: Promise<void> = Promise.resolve();
let publicLcscLastStart = 0;

/**
 * Serialize public-search calls with at least `intervalMs` between request
 * starts. Exported for tests; the default is the community courtesy limit.
 */
export async function throttlePublicLcsc(
  intervalMs = PUBLIC_LCSC_MIN_INTERVAL_MS,
): Promise<void> {
  const previous = publicLcscQueue;
  let release!: () => void;
  publicLcscQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const wait = Math.max(0, intervalMs - (Date.now() - publicLcscLastStart));
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    publicLcscLastStart = Date.now();
  } finally {
    release();
  }
}

type PublicLcscProduct = {
  productCode?: string;
  productModel?: string;
  brandNameEn?: string;
  productStockNumber?: number | string;
  productDesc?: string;
  images?: string[];
  pdfUrl?: string;
  priceList?: { modifier?: number | string; price?: number | string }[];
};

function asPublicPart(raw: PublicLcscProduct): DistributorPart {
  const priceBreaks: DistributorPriceBreak[] = (raw.priceList ?? []).flatMap(
    (entry) => {
      const qty = Number(entry.modifier);
      const unit = Number(entry.price);
      return Number.isFinite(qty) && Number.isFinite(unit)
        ? [{ breakQuantity: qty, unitPrice: unit }]
        : [];
    },
  ).sort((a, b) => a.breakQuantity - b.breakQuantity);

  const stock = Number(raw.productStockNumber ?? NaN);
  const code = String(raw.productCode ?? "").toUpperCase();

  return {
    distributor: "lcsc",
    productCode: code,
    mpn: String(raw.productModel ?? ""),
    manufacturer: String(raw.brandNameEn ?? ""),
    description: String(raw.productDesc ?? ""),
    categoryPath: [],
    packageName: "",
    datasheetUrl: raw.pdfUrl?.trim() ? String(raw.pdfUrl) : null,
    sourceUrl: code
      ? `https://www.lcsc.com/product-detail/${code}.html`
      : "",
    imageUrls: (raw.images ?? []).filter((u) => typeof u === "string"),
    parameters: [],
    priceBreaks,
    // The public endpoint quotes no currency — never treat it as USD.
    currency: "UNK",
    inStock: Number.isFinite(stock) ? (stock as number) > 0 : false,
    stockAvailable: Number.isFinite(stock) ? (stock as number) : null,
    minimumOrderQuantity: null,
  };
}

/**
 * Public community search fallback. Mirrors a standard site search; carries
 * no auth, so it is throttled and returns slimmer rows than the official API.
 */
async function publicLcscSearch(
  keyword: string,
  limit = 10,
): Promise<DistributorPart[]> {
  await throttlePublicLcsc();

  const body = new URLSearchParams({
    current_page: "1",
    in_stock: "false",
    is_RoHS: "false",
    show_icon: "false",
    search_content: keyword.trim(),
  });

  let response: Response;
  try {
    response = await fetch(PUBLIC_LCSC_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": PUBLIC_LCSC_USER_AGENT,
        Accept: "application/json",
      },
      body: body.toString(),
    });
  } catch (error) {
    throw new DistributorError(
      "lcsc",
      "network",
      `Could not reach the LCSC public search (${error instanceof Error ? error.message : "network error"}). Set LCSC_API_KEY / LCSC_API_SECRET to use the official API instead.`,
    );
  }

  if (!response.ok) {
    throw new DistributorError(
      "lcsc",
      "network",
      `LCSC public search was blocked (HTTP ${response.status}). Set LCSC_API_KEY / LCSC_API_SECRET to use the official API instead.`,
    );
  }

  let data: {
    result?: { productList?: PublicLcscProduct[] };
  };
  try {
    data = (await response.json()) as {
      result?: { productList?: PublicLcscProduct[] };
    };
  } catch {
    throw new DistributorError(
      "lcsc",
      "bad-response",
      "LCSC public search was blocked or returned a non-JSON page. Set LCSC_API_KEY / LCSC_API_SECRET to use the official API instead.",
    );
  }

  const list = data?.result?.productList;
  if (!Array.isArray(list)) {
    throw new DistributorError(
      "lcsc",
      "bad-response",
      "LCSC public search returned an unexpected shape.",
    );
  }
  return list.slice(0, limit).map(asPublicPart).filter((p) => p.productCode);
}

/**
 * Search LCSC by keyword (C-code, MPN, brand, package, parameters). Uses the
 * official signed API when keys are configured, otherwise the throttled
 * public community search.
 */
export async function searchLcscParts(
  keyword: string,
  opts?: { limit?: number; currency?: string },
): Promise<DistributorPart[]> {
  const creds = getCredentials();
  if (!creds) {
    return publicLcscSearch(keyword, opts?.limit ?? 10);
  }

  const result = (await lcscGet(
    "/rest/api/agent/product/v1/keywordsearch",
    {
      keyword: keyword.trim(),
      limit: opts?.limit ?? 10,
      offset: 0,
      language: "EN",
      returnInformation: "All",
      currency: opts?.currency ?? "USD",
    },
    creds,
  )) as { products?: LcscProduct[] };

  return (result.products ?? []).map(asPart).filter((p) => p.productCode);
}

/**
 * Fetch one part by LCSC product code. Exact C-number match wins; otherwise
 * null (the search may return only fuzzy neighbours).
 */
export async function fetchLcscPartByCode(code: string): Promise<DistributorPart | null> {
  const normalized = normalizeLcscCode(code);
  const parts = await searchLcscParts(normalized, { limit: 10 });
  return parts.find((p) => p.productCode.toUpperCase() === normalized) ?? null;
}

/**
 * Best-guess catalog category from the LCSC category path. Returns null when
 * nothing matches — the importer then asks the user to choose.
 */
export function guessCatalogCategory(categoryPath: string[]): string | null {
  const haystack = categoryPath.join(" / ").toLowerCase();

  const rules: [RegExp, string][] = [
    [/\bldo\b|linear voltage regulator/, "ldo"],
    [/\bbuck\b|step-?down|dc-?dc converter/, "buck"],
    [/battery charger|charge(r| management).*ic|charger ic/, "battery-charger"],
    [/fuel gauge|battery monitor|battery management(?!.*charg)/, "fuel-gauge"],
    [/\bbattery\b|supercapacitor|coin cell|18650|lipo|li-?ion (cell|battery)/, "battery"],
    [/real-?time clock|\brtc\b/, "rtc"],
    [/analog-?to-?digital|\badc\b/, "adc"],
    [/microcontroller|\bmcu\b|wireless.*modul|bluetooth.*modul|wifi.*modul|esp32|zigbee/, "mcu"],
    [/load switch|efuse|e-?fuse|power switch|power mux|ideal diode/, "load-switch"],
    [/rs-?485|rs-?232|can transceiver|transceiver/, "transceiver"],
    [/cellular|lte|nb-?iot|gsm|4g|5g module|cat-?m/, "cellular"],
    [/gnss|gps|positioning|gnss module/, "gnss"],
    [/ultrasonic|time-?of-?flight|tof|lidar|liquid level|level sensor|distance sensor/, "level-sensor"],
    [/temperature.*sensor|humidity.*sensor|pressure.*sensor|gas sensor|environmental/, "environmental-sensor"],
  ];

  for (const [pattern, category] of rules) {
    if (pattern.test(haystack)) return category;
  }
  return null;
}

function parseDecimal(raw: string): number | null {
  const match = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** "500mA" → 0.5, "10µA"/"10uA" → 0.00001, "3.3V" → 3.3, null when unknown. */
export function parseEngineeringValue(
  raw: string,
  unit: "V" | "A" | "C",
): number | null {
  const value = parseDecimal(raw);
  if (value === null || !Number.isFinite(value)) return null;
  const lower = raw.toLowerCase();

  if (unit === "C") {
    const normalized = lower.replace(/℃/g, "c").replace(/℉/g, "f");
    if (!/[cf°]|deg/.test(normalized)) return null;
    if (normalized.includes("f") && !normalized.includes("c")) {
      return tidy((value - 32) * (5 / 9));
    }
    return tidy(value);
  }

  const milli = unit === "V" ? /mv\b/ : /ma\b/;
  const micro = /[µu]a\b/.test(lower) && unit === "A" ? true : /[µu]v\b/.test(lower) && unit === "V";
  if (micro) return tidy(value / 1_000_000);
  if (milli.test(lower)) return tidy(value / 1000);
  return tidy(value);
}

/** Drop binary float dust (1.6e-6 → 0.0000016, not …161). */
function tidy(value: number): number {
  return Number(value.toPrecision(12));
}

function splitRangeEnds(raw: string): [string, string] | null {
  for (const sep of ["~", "–", "—"]) {
    if (raw.includes(sep)) {
      const parts = raw.split(sep);
      if (parts.length === 2) return [parts[0]!.trim(), parts[1]!.trim()];
      return null;
    }
  }
  const wordSplit = raw.split(/\bto\b/i);
  if (wordSplit.length === 2) return [wordSplit[0]!.trim(), wordSplit[1]!.trim()];
  // Hyphen ranges only when the value doesn't open with a minus sign, so
  // "-55℃~+155℃"-style negatives never split into three pieces.
  if (!raw.trimStart().startsWith("-")) {
    const parts = raw.split("-");
    if (parts.length === 2 && parts[0]!.trim() && parts[1]!.trim()) {
      return [parts[0]!.trim(), parts[1]!.trim()];
    }
  }
  return null;
}

function parseRangeEnds(raw: string, unit: "V" | "A" | "C"): [number, number] | null {
  const split = splitRangeEnds(raw);
  if (!split) return null;
  const ends = split.map((s) => parseEngineeringValue(s, unit));
  if (ends.length === 2 && ends[0] !== null && ends[1] !== null) {
    return ends[0] <= ends[1] ? [ends[0], ends[1]] : [ends[1], ends[0]];
  }
  return null;
}

/**
 * Map LCSC product parameters onto catalog spec metrics. Conservative on
 * purpose: only widely-unambiguous parameters map; everything else stays one
 * click away on the LCSC product page.
 */
export function mapLcscParametersToSpecs(
  parameters: DistributorParameter[],
): Record<string, number> {
  const specs: Record<string, number> = {};

  for (const { name, value } of parameters) {
    const key = name.trim().toLowerCase();
    if (!value.trim()) continue;

    if (/operating temperature|temperature range/.test(key)) {
      const range = parseRangeEnds(value, "C");
      if (range) {
        specs.operatingTempMinC ??= range[0];
        specs.operatingTempMaxC ??= range[1];
      }
      continue;
    }
    if (/supply voltage|operating voltage|input voltage/.test(key)) {
      const range = parseRangeEnds(value, "V");
      if (range) {
        specs.supplyMinV ??= range[0];
        specs.supplyMaxV ??= range[1];
      }
      continue;
    }
    if (/output voltage/.test(key) && !/range|adjustable/.test(value.toLowerCase())) {
      const v = parseEngineeringValue(value, "V");
      if (v !== null) specs.outputVoltageV ??= v;
      continue;
    }
    if (/output current|continuous.*current|load current/.test(key)) {
      const single = parseEngineeringValue(value, "A");
      if (single !== null && !/~/u.test(value)) specs.outputCurrentMaxA ??= single;
      else {
        const range = parseRangeEnds(value, "A");
        if (range) specs.outputCurrentMaxA ??= range[1];
      }
      continue;
    }
    if (/quiescent current/.test(key)) {
      const v = parseEngineeringValue(value, "A");
      if (v !== null) specs.quiescentCurrentA ??= v;
      continue;
    }
    if (/shutdown current|standby current|sleep current/.test(key)) {
      const v = parseEngineeringValue(value, "A");
      if (v !== null) specs.sleepCurrentA ??= v;
    }
  }

  return specs;
}
