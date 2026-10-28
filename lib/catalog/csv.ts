import { z } from "zod";

import {
  CATALOG_CATEGORY_KEYS,
  isCatalogCategory,
  type CatalogPartSeed,
} from "@/lib/catalog/types";

/**
 * CSV import for the local catalog. Columns:
 * id,partNumber,manufacturer,category,description,package,datasheetUrl,
 * sourceUrl,sourceRetrievedAt,priceUsd,specsJson,tags
 *
 * `id` may be empty; a stable `cat-import-<slug>` id is derived from the part
 * number so re-imports update instead of duplicating. `tags` is `;`-separated.
 * `priceUsd` may be empty (unknown). `sourceRetrievedAt` defaults to today.
 */

export const catalogCsvRowSchema = z.object({
  id: z.string().trim(),
  partNumber: z.string().trim().min(1, "partNumber is required"),
  manufacturer: z.string().trim().min(1, "manufacturer is required"),
  category: z.string().trim().min(1, "category is required"),
  description: z.string().trim().min(1, "description is required"),
  package: z.string().trim().min(1, "package is required"),
  datasheetUrl: z.string().trim().url("datasheetUrl must be a URL"),
  sourceUrl: z.string().trim().url("sourceUrl must be a URL"),
  sourceRetrievedAt: z.string().trim(),
  priceUsd: z.string().trim(),
  specsJson: z.string().trim().min(1, "specsJson is required"),
  tags: z.string().trim(),
});

export type CatalogCsvIssue = {
  line: number;
  message: string;
};

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

export function slugifyPartNumber(partNumber: string): string {
  const slug = partNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `cat-import-${slug || "part"}`;
}

function parsePrice(raw: string, line: number): number | null | CatalogCsvIssue {
  if (raw === "") {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return { line, message: `invalid priceUsd: "${raw}"` };
  }
  return value;
}

export function parseCatalogCsv(text: string): {
  parts: CatalogPartSeed[];
  issues: CatalogCsvIssue[];
} {
  const parts: CatalogPartSeed[] = [];
  const issues: CatalogCsvIssue[] = [];
  const lines = text.split(/\r?\n/);

  if (lines.length === 0 || (lines.length === 1 && lines[0]?.trim() === "")) {
    return { parts, issues: [{ line: 0, message: "empty file" }] };
  }

  const header = splitCsvLine(lines[0] ?? "");
  const expected = Object.keys(catalogCsvRowSchema.shape);

  if (
    header.length !== expected.length ||
    !expected.every((column, index) => header[index] === column)
  ) {
    return {
      parts,
      issues: [
        {
          line: 1,
          message: `header must be exactly: ${expected.join(",")}`,
        },
      ],
    };
  }

  const seenPartNumbers = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";

    if (raw.trim() === "") {
      continue;
    }

    const line = i + 1;
    const fields = splitCsvLine(raw);

    if (fields.length !== expected.length) {
      issues.push({
        line,
        message: `expected ${expected.length} columns, got ${fields.length}`,
      });
      continue;
    }

    const record = Object.fromEntries(
      expected.map((column, index) => [column, fields[index] ?? ""]),
    );
    const parsed = catalogCsvRowSchema.safeParse(record);

    if (!parsed.success) {
      issues.push({
        line,
        message: parsed.error.issues[0]?.message ?? "invalid row",
      });
      continue;
    }

    const row = parsed.data;

    if (!isCatalogCategory(row.category)) {
      issues.push({
        line,
        message: `unknown category "${row.category}" (expected one of ${CATALOG_CATEGORY_KEYS.join(", ")})`,
      });
      continue;
    }
    if (seenPartNumbers.has(row.partNumber)) {
      issues.push({
        line,
        message: `duplicate partNumber "${row.partNumber}" in this file`,
      });
      continue;
    }

    let specs: CatalogPartSeed["specs"];
    try {
      const value: unknown = JSON.parse(row.specsJson);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("not an object");
      }
      specs = value as CatalogPartSeed["specs"];
    } catch {
      issues.push({ line, message: "specsJson must be a JSON object" });
      continue;
    }

    let retrievedAt = row.sourceRetrievedAt || new Date().toISOString().slice(0, 10);
    if (Number.isNaN(Date.parse(retrievedAt))) {
      issues.push({ line, message: `invalid sourceRetrievedAt: "${row.sourceRetrievedAt}"` });
      continue;
    }
    retrievedAt = new Date(retrievedAt).toISOString();

    const price = parsePrice(row.priceUsd, line);
    if (price !== null && typeof price === "object") {
      issues.push(price);
      continue;
    }

    seenPartNumbers.add(row.partNumber);
    parts.push({
      id: row.id || slugifyPartNumber(row.partNumber),
      partNumber: row.partNumber,
      manufacturer: row.manufacturer,
      category: row.category,
      description: row.description,
      package: row.package,
      datasheetUrl: row.datasheetUrl,
      sourceUrl: row.sourceUrl,
      sourceRetrievedAt: retrievedAt,
      priceUsd: price,
      tags: row.tags
        .split(";")
        .map((tag) => tag.trim())
        .filter(Boolean),
      specs: { ...specs, priceUsd: price ?? undefined },
    });
  }

  return { parts, issues };
}
