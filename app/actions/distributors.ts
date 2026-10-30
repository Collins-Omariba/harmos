"use server";

import { revalidatePath } from "next/cache";

import {
  fetchLcscPartByCode,
  guessCatalogCategory,
  mapLcscParametersToSpecs,
  normalizeLcscCode,
} from "@/lib/distributors/lcsc";
import { DistributorError } from "@/lib/distributors/types";
import { isCatalogCategory } from "@/lib/catalog/types";
import { validateSpecsObject } from "@/lib/catalog/specs";
import { prisma } from "@/lib/db";

export type LcscPreview = {
  productCode: string;
  mpn: string;
  manufacturer: string;
  description: string;
  packageName: string;
  priceUsd: number | null;
  /** Raw listing when the currency is unverified (public fallback) — shown, never stored. */
  listingPrice: string | null;
  currency: string;
  inStock: boolean;
  stockAvailable: number | null;
  datasheetUrl: string | null;
  sourceUrl: string;
  categoryPath: string[];
  categoryGuess: string | null;
  mappedSpecCount: number;
  parameterCount: number;
};

export type LcscLookupResult =
  | { ok: true; part: LcscPreview }
  | { ok: false; message: string };

export type LcscImportResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function toPreview(
  part: Awaited<ReturnType<typeof fetchLcscPartByCode>>,
): LcscPreview {
  if (!part) throw new Error("unreachable");
  const firstBreak = part.priceBreaks[0];
  return {
    productCode: part.productCode,
    mpn: part.mpn,
    manufacturer: part.manufacturer,
    description: part.description,
    packageName: part.packageName,
    priceUsd:
      part.currency === "USD" ? (firstBreak?.unitPrice ?? null) : null,
    listingPrice:
      part.currency === "USD" || !firstBreak
        ? null
        : `${firstBreak.unitPrice} (unverified currency — not stored)`,
    currency: part.currency,
    inStock: part.inStock,
    stockAvailable: part.stockAvailable,
    datasheetUrl: part.datasheetUrl,
    sourceUrl: part.sourceUrl,
    categoryPath: part.categoryPath,
    categoryGuess: guessCatalogCategory(part.categoryPath),
    mappedSpecCount: Object.keys(
      mapLcscParametersToSpecs(part.parameters),
    ).length,
    parameterCount: part.parameters.length,
  };
}

function explain(error: unknown): string {
  if (error instanceof DistributorError) return error.message;
  return "The LCSC lookup failed — check the code and try again.";
}

/** Look up an LCSC product code without writing anything. */
export async function previewLcscImportAction(
  rawCode: string,
): Promise<LcscLookupResult> {
  let code: string;
  try {
    code = normalizeLcscCode(rawCode);
  } catch (error) {
    return { ok: false, message: explain(error) };
  }

  try {
    const part = await fetchLcscPartByCode(code);
    if (!part) {
      return { ok: false, message: `LCSC has no exact match for ${code}.` };
    }
    return { ok: true, part: toPreview(part) };
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
}

/** Re-fetch the LCSC row and copy it into the local catalog. */
export async function importLcscPartAction(
  rawCode: string,
  category: string,
): Promise<LcscImportResult> {
  if (!isCatalogCategory(category)) {
    return { ok: false, message: "Choose a catalog category for the import." };
  }

  let code: string;
  try {
    code = normalizeLcscCode(rawCode);
  } catch (error) {
    return { ok: false, message: explain(error) };
  }

  let part;
  try {
    part = await fetchLcscPartByCode(code);
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
  if (!part) {
    return { ok: false, message: `LCSC has no exact match for ${code}.` };
  }

  if (!part.mpn) {
    return {
      ok: false,
      message: `LCSC lists no manufacturer part number for ${code} — add it manually instead.`,
    };
  }
  if (!part.datasheetUrl) {
    return {
      ok: false,
      message: `LCSC has no datasheet on file for ${code} — add it manually with its source.`,
    };
  }

  const taken = await prisma.catalogPart.findUnique({
    where: { partNumber: part.mpn },
  });
  if (taken) {
    return {
      ok: false,
      message: `"${part.mpn}" is already in the catalog (${taken.origin} row) — no duplicate created.`,
    };
  }

  const mapped = validateSpecsObject(mapLcscParametersToSpecs(part.parameters));
  const specsJson = JSON.stringify("specs" in mapped ? mapped.specs : {});
  const description =
    part.description.trim().length >= 10
      ? part.description.trim()
      : `${part.manufacturer} ${part.mpn}`.trim();

  try {
    await prisma.catalogPart.create({
      data: {
        id: `cat-lcsc-${code.toLowerCase()}`,
        partNumber: part.mpn,
        manufacturer: part.manufacturer || "Unknown",
        category,
        description,
        package: part.packageName || "Unspecified",
        datasheetUrl: part.datasheetUrl,
        sourceUrl: part.sourceUrl || part.datasheetUrl,
        sourceRetrievedAt: new Date(),
        priceUsd:
          part.currency === "USD"
            ? (part.priceBreaks[0]?.unitPrice ?? null)
            : null,
        specsJson,
        // Identifies LCSC as the source, per the LCSC API terms of use.
        tags: `lcsc:${code}`,
        origin: "imported",
      },
    });
  } catch {
    return {
      ok: false,
      message: `Could not import ${part.mpn} (is its part number taken?).`,
    };
  }

  revalidatePath("/catalog");
  return { ok: true, message: `Imported ${part.mpn} (${code}) to the catalog.` };
}
