import {
  CATALOG_CATEGORIES,
  type CatalogPart,
} from "@/lib/catalog/types";
import { isSourceStale, sourceAgeMonths } from "@/lib/catalog/staleness";
import { evaluateConstraint } from "@/lib/comparison/scorer";
import {
  readMetric,
  type ComparisonConstraint,
} from "@/lib/comparison/types";

export type CatalogSearchResult = {
  parts: CatalogPart[];
  category: string | null;
  priceCeiling: number | null;
};

const STOPWORDS = new Set([
  "what",
  "which",
  "do",
  "we",
  "have",
  "under",
  "below",
  "with",
  "for",
  "the",
  "and",
  "catalog",
  "part",
  "parts",
  "show",
  "find",
  "list",
  "please",
]);

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function categoryFromQuery(query: string): string | null {
  const q = ` ${query.toLowerCase()} `;
  const aliases: [string, string[]][] = [
    ["ldo", ["ldo", "linear regulator"]],
    ["buck", ["buck", "step-down", "step down"]],
    ["mcu", ["mcu", "microcontroller", "esp32"]],
    ["level-sensor", ["level sensor", "ultrasonic", "tank level"]],
    ["battery", ["battery", "batteries", "18650", "cell"]],
    ["battery-charger", ["charger", "charging"]],
    ["environmental-sensor", ["environmental", "temperature sensor", "humidity"]],
    ["adc", ["adc", "analog-to-digital", "analog to digital"]],
    ["rtc", ["rtc", "real-time clock", "real time clock"]],
    ["fuel-gauge", ["fuel gauge", "battery gauge"]],
    ["load-switch", ["load switch", "power mux"]],
    ["transceiver", ["rs-485", "rs485", "modbus", "transceiver"]],
    ["cellular", ["cellular", "lte", "4g", "2g", "gsm"]],
    ["gnss", ["gnss", "gps", "positioning"]],
  ];

  for (const [category, words] of aliases) {
    if (words.some((word) => q.includes(word))) return category;
  }
  return (
    CATALOG_CATEGORIES.find(
      (category) =>
        q.includes(category.key.replaceAll("-", " ")) ||
        q.includes(category.label.toLowerCase()),
    )?.key ?? null
  );
}

function priceCeilingFromQuery(query: string): number | null {
  const match = query.match(/(?:under|below|less than|max(?:imum)?|<=?)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  return match ? Number(match[1]) : null;
}

export function searchCatalog(
  parts: CatalogPart[],
  query: string,
  limit = 8,
): CatalogSearchResult {
  const category = categoryFromQuery(query);
  const priceCeiling = priceCeilingFromQuery(query);
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));

  const scored = parts
    .filter((part) => !category || part.category === category)
    .filter(
      (part) =>
        priceCeiling === null ||
        (part.priceUsd !== null && part.priceUsd <= priceCeiling),
    )
    .map((part) => {
      const pn = part.partNumber.toLowerCase();
      const haystack = [
        part.partNumber,
        part.manufacturer,
        part.category,
        part.description,
        part.package,
        ...part.tags,
      ]
        .join(" ")
        .toLowerCase();
      let score = category && part.category === category ? 4 : 0;

      for (const token of tokens) {
        if (pn === token) score += 12;
        else if (pn.includes(token)) score += 7;
        if (part.manufacturer.toLowerCase().includes(token)) score += 3;
        if (part.tags.some((tag) => tag.toLowerCase().includes(token))) score += 3;
        if (haystack.includes(token)) score += 1;
      }
      return { part, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.part.priceUsd ?? Number.POSITIVE_INFINITY) -
          (b.part.priceUsd ?? Number.POSITIVE_INFINITY) ||
        a.part.partNumber.localeCompare(b.part.partNumber),
    )
    .slice(0, limit)
    .map(({ part }) => part);

  return { parts: scored, category, priceCeiling };
}

export type CatalogGap = {
  constraint: ComparisonConstraint;
  passingByCategory: { category: string; passing: number; total: number }[];
  totalPassing: number;
  gapCategories: string[];
};

export function analyzeCatalogGaps(
  constraints: ComparisonConstraint[],
  parts: CatalogPart[],
): CatalogGap[] {
  const allCategories = CATALOG_CATEGORIES.map((category) => category.key);

  return constraints.map((constraint) => {
    // Unscoped preset constraints should not demand coverage from categories
    // that never carry the metric (for example, range on an LDO). Treat a
    // category as relevant when at least one of its parts specifies it.
    const relevantCategories = allCategories.filter((category) =>
      parts.some((part) => {
        if (part.category !== category) return false;
        if (constraint.metric === "supplyVoltageV") {
          return part.specs.supplyMinV !== undefined || part.specs.supplyMaxV !== undefined;
        }
        return readMetric(part.specs, constraint.metric) !== null;
      }),
    );
    const categories =
      constraint.appliesTo.length > 0
        ? constraint.appliesTo
        : relevantCategories.length > 0
          ? relevantCategories
          : allCategories;
    const passingByCategory = categories.map((category) => {
      const inCategory = parts.filter((part) => part.category === category);
      return {
        category,
        passing: inCategory.filter(
          (part) => evaluateConstraint(part.specs, constraint).passed,
        ).length,
        total: inCategory.length,
      };
    });

    return {
      constraint,
      passingByCategory,
      totalPassing: passingByCategory.reduce((sum, row) => sum + row.passing, 0),
      gapCategories: passingByCategory
        .filter((row) => row.passing === 0)
        .map((row) => row.category),
    };
  });
}

export function findDuplicateGroups(parts: CatalogPart[]): CatalogPart[][] {
  const parent = new Map<string, string>();

  function find(id: string): string {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  }

  for (const part of parts) parent.set(part.id, part.id);

  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const a = parts[i];
      const b = parts[j];
      if (!a || !b) continue;
      const an = normalized(a.partNumber);
      const bn = normalized(b.partNumber);
      const sameManufacturer =
        normalized(a.manufacturer) === normalized(b.manufacturer);
      const exact = an === bn;
      const near =
        sameManufacturer &&
        an.length >= 5 &&
        bn.length >= 5 &&
        (an.startsWith(bn) || bn.startsWith(an));
      if (exact || near) union(a.id, b.id);
    }
  }

  const groups = new Map<string, CatalogPart[]>();
  for (const part of parts) {
    const root = find(part.id);
    groups.set(root, [...(groups.get(root) ?? []), part]);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) =>
      [...group].sort((a, b) => a.partNumber.localeCompare(b.partNumber)),
    )
    .sort((a, b) => (a[0]?.partNumber ?? "").localeCompare(b[0]?.partNumber ?? ""));
}

export type CatalogHealthIssue = {
  part: CatalogPart;
  issues: string[];
  severity: number;
  ageMonths: number | null;
};

export function catalogHealthQueue(
  parts: CatalogPart[],
  now = new Date(),
  limit = 12,
): CatalogHealthIssue[] {
  return parts
    .map((part) => {
      const issues: string[] = [];
      let severity = 0;
      const ageMonths = sourceAgeMonths(part.sourceRetrievedAt, now);

      if (!part.datasheetUrl || !part.sourceUrl) {
        issues.push("missing source link");
        severity += 3;
      }
      if (isSourceStale(part.sourceRetrievedAt, now)) {
        issues.push(`source is ${ageMonths} months old`);
        severity += 3;
      }
      const specCount = Object.keys(part.specs).filter(
        (key) => key !== "priceUsd",
      ).length;
      if (specCount < 3) {
        issues.push(`only ${specCount} structured specs`);
        severity += 2;
      }
      if (part.priceUsd === null) {
        issues.push("no indicative price");
        severity += 1;
      }

      return { part, issues, severity, ageMonths };
    })
    .filter((row) => row.severity > 0)
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        (b.ageMonths ?? 0) - (a.ageMonths ?? 0) ||
        a.part.partNumber.localeCompare(b.part.partNumber),
    )
    .slice(0, limit);
}
