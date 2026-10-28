import { validateSpecsObject } from "@/lib/catalog/specs";
import {
  isCatalogCategory,
  type CatalogCategoryKey,
  type CatalogSpecs,
} from "@/lib/catalog/types";
import type { CatalogCandidateDraft } from "@/lib/ai/tasks/suggest_catalog_parts";

export type ValidatedProposal = {
  partNumber: string;
  manufacturer: string;
  category: CatalogCategoryKey;
  description: string;
  package: string;
  datasheetUrl: string | null;
  sourceUrl: string | null;
  specs: CatalogSpecs;
  priceUsd: number | null;
  tags: string[];
  confidence: "high" | "medium" | "low";
  note: string;
  warnings: string[];
};

function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!/^https:\/\//.test(trimmed)) {
    return null;
  }
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Validates one AI-drafted candidate. Fatal problems (missing identity,
 * unknown category, duplicate part number, zero usable specs) reject the
 * candidate outright; soft problems (malformed URLs, unknown spec keys, bad
 * prices) are stripped with a recorded warning so a human sees exactly what
 * was dropped. Plausible-but-invented links cannot be caught by syntax —
 * that is what the review queue, the shown link, and the datasheet-required
 * approval rule are for.
 */
export function validateProposalCandidate(
  raw: CatalogCandidateDraft,
  existingPartNumbers: Set<string>,
): { candidate: ValidatedProposal } | { error: string } {
  const partNumber = (raw.partNumber ?? "").trim();
  const manufacturer = (raw.manufacturer ?? "").trim();
  const description = (raw.description ?? "").trim();
  const pkg = (raw.package ?? "").trim();

  if (!partNumber || !manufacturer || !description || !pkg) {
    return {
      error: `Candidate is missing identity fields (need part number, manufacturer, description, package).`,
    };
  }
  if (!isCatalogCategory(raw.category)) {
    return { error: `"${partNumber}" has unknown category "${raw.category}".` };
  }
  if (existingPartNumbers.has(partNumber.toLowerCase())) {
    return { error: `"${partNumber}" is already in the catalog.` };
  }

  const warnings: string[] = [];

  const datasheetUrl = cleanUrl(raw.datasheetUrl);
  if (raw.datasheetUrl && !datasheetUrl) {
    warnings.push("Dropped an invalid datasheet URL; add the real one.");
  }
  const sourceUrl = cleanUrl(raw.sourceUrl);
  if (raw.sourceUrl && !sourceUrl) {
    warnings.push("Dropped an invalid source URL; add the real one.");
  }

  const specs: CatalogSpecs = {};
  if (raw.specs && typeof raw.specs === "object" && !Array.isArray(raw.specs)) {
    for (const [key, value] of Object.entries(raw.specs)) {
      const checked = validateSpecsObject({ [key]: value });
      if ("specs" in checked) {
        Object.assign(specs, checked.specs);
      } else {
        warnings.push(`Dropped spec "${key}": ${checked.error}`);
      }
    }
  }
  if (Object.keys(specs).length === 0) {
    return { error: `"${partNumber}" has no usable specs left.` };
  }

  let priceUsd: number | null = null;
  if (typeof raw.priceUsd === "number") {
    if (Number.isFinite(raw.priceUsd) && raw.priceUsd >= 0) {
      priceUsd = raw.priceUsd;
    } else {
      warnings.push("Dropped an invalid price; left as unknown.");
    }
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter(
        (tag): tag is string => typeof tag === "string" && tag.trim() !== "",
      )
    : [];

  return {
    candidate: {
      partNumber,
      manufacturer,
      category: raw.category,
      description,
      package: pkg,
      datasheetUrl,
      sourceUrl,
      specs,
      priceUsd,
      tags,
      confidence:
        raw.confidence === "high" ||
        raw.confidence === "medium" ||
        raw.confidence === "low"
          ? raw.confidence
          : "medium",
      note: typeof raw.note === "string" && raw.note.trim() !== "" ? raw.note : "No note provided.",
      warnings,
    },
  };
}
