"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { splitTags, validateSpecsObject } from "@/lib/catalog/specs";
import { isCatalogCategory } from "@/lib/catalog/types";
import { prisma } from "@/lib/db";

export type CatalogActionState = {
  ok: boolean;
  message: string;
} | null;

function fail(message: string): CatalogActionState {
  return { ok: false, message };
}

function done(message: string): CatalogActionState {
  revalidatePath("/catalog");
  return { ok: true, message };
}

const catalogSchema = z.object({
  partNumber: z.string().trim().min(1, "Part number is required."),
  manufacturer: z.string().trim().min(1, "Manufacturer is required."),
  category: z.string().min(1, "Choose a category."),
  description: z
    .string()
    .trim()
    .min(10, "Description needs a sentence or two."),
  package: z.string().trim().min(1, "Package is required."),
  datasheetUrl: z.string().trim().url("Datasheet must be a URL."),
  sourceUrl: z.string().trim().url("Source must be a URL."),
  sourceRetrievedAt: z.string().min(1, "Retrieval date is required."),
  priceUsd: z.string().trim(),
  tags: z.string().trim(),
  specsJson: z.string().trim().min(1, "Specs are required."),
});

function parsePrice(raw: string): { price: number | null } | { error: string } {
  const trimmed = raw.trim().replace(/^\$/, "");

  if (trimmed === "") {
    return { price: null };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { error: 'Price must look like "12.50". Leave it empty if unknown.' };
  }

  return { price: Number(trimmed) };
}

type ParsedPart =
  | {
      partNumber: string;
      manufacturer: string;
      category: string;
      description: string;
      package: string;
      datasheetUrl: string;
      sourceUrl: string;
      sourceRetrievedAt: Date;
      priceUsd: number | null;
      specsJson: string;
      tags: string;
    }
  | { error: string };

function parsePartForm(formData: FormData): ParsedPart {
  const parsed = catalogSchema.safeParse({
    partNumber: formData.get("partNumber"),
    manufacturer: formData.get("manufacturer"),
    category: formData.get("category"),
    description: formData.get("description"),
    package: formData.get("package"),
    datasheetUrl: formData.get("datasheetUrl"),
    sourceUrl: formData.get("sourceUrl"),
    sourceRetrievedAt: formData.get("sourceRetrievedAt"),
    priceUsd: formData.get("priceUsd") ?? "",
    tags: formData.get("tags") ?? "",
    specsJson: formData.get("specsJson"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the part." };
  }

  const data = parsed.data;

  if (!isCatalogCategory(data.category)) {
    return { error: `Unknown category "${data.category}".` };
  }

  const retrievedAt = new Date(data.sourceRetrievedAt);
  if (Number.isNaN(retrievedAt.getTime())) {
    return { error: "Retrieval date is not a valid date." };
  }

  const price = parsePrice(data.priceUsd);
  if ("error" in price) {
    return price;
  }

  let specsValue: unknown;
  try {
    specsValue = JSON.parse(data.specsJson);
  } catch {
    return { error: "Specs must be valid JSON." };
  }

  const specs = validateSpecsObject(specsValue);
  if ("error" in specs) {
    return specs;
  }

  // The price column is the source of truth; the adapter re-adds it on read.
  const cleanSpecs: Record<string, unknown> = { ...specs.specs };
  delete cleanSpecs.priceUsd;

  return {
    partNumber: data.partNumber,
    manufacturer: data.manufacturer,
    category: data.category,
    description: data.description,
    package: data.package,
    datasheetUrl: data.datasheetUrl,
    sourceUrl: data.sourceUrl,
    sourceRetrievedAt: retrievedAt,
    priceUsd: price.price,
    specsJson: JSON.stringify(cleanSpecs),
    tags: splitTags(data.tags).join(", "),
  };
}

export async function createCatalogPartAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const parsed = parsePartForm(formData);
  if ("error" in parsed) {
    return fail(parsed.error);
  }

  const taken = await prisma.catalogPart.findUnique({
    where: { partNumber: parsed.partNumber },
  });
  if (taken) {
    return fail(`Part number "${parsed.partNumber}" is already in the catalog.`);
  }

  try {
    await prisma.catalogPart.create({
      data: {
        id: `cat-custom-${crypto.randomUUID().slice(0, 8)}`,
        ...parsed,
        origin: "custom",
      },
    });
  } catch {
    return fail("Could not add the part (is the part number taken?).");
  }

  return done(`Added ${parsed.partNumber} to the catalog.`);
}

export async function updateCatalogPartAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const recordId = String(formData.get("recordId") ?? "");
  const parsed = parsePartForm(formData);
  if ("error" in parsed) {
    return fail(parsed.error);
  }

  const taken = await prisma.catalogPart.findUnique({
    where: { partNumber: parsed.partNumber },
  });
  if (taken && taken.id !== recordId) {
    return fail(`Part number "${parsed.partNumber}" belongs to another row.`);
  }

  const updated = await prisma.catalogPart.updateMany({
    where: { id: recordId },
    data: parsed,
  });

  if (updated.count === 0) {
    return fail("Part not found in the catalog.");
  }

  return done(`Updated ${parsed.partNumber}.`);
}

export async function deleteCatalogPartAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.catalogPart.deleteMany({
    where: { id: recordId },
  });

  if (deleted.count === 0) {
    return fail("Part not found in the catalog.");
  }

  return done("Part removed from the catalog.");
}
