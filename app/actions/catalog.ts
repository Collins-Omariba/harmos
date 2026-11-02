"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { suggestCatalogParts } from "@/lib/ai/tasks/suggest_catalog_parts";
import { fetchPageText, normalizeUrl } from "@/lib/fetch-page";
import {
  specsFromFormEntries,
  splitTags,
  validateSpecsObject,
} from "@/lib/catalog/specs";
import { isCatalogCategory } from "@/lib/catalog/types";
import { prisma } from "@/lib/db";

export type CatalogActionState = {
  ok: boolean;
  message: string;
  /**
   * The model's reply text for the propose action, shown verbatim so the
   * user can transcribe parts into the add-part form by hand.
   */
  rawOutput?: string | null;
} | null;

function fail(message: string): CatalogActionState {
  return { ok: false, message };
}

/** Cap raw model text so a runaway reply can't blow up the dialog state. */
function truncateRawOutput(raw: string, maxChars = 12_000): string {
  const trimmed = raw.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n… [truncated — full text in logs/ai.log]`;
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
  datasheetUrl: z
    .string()
    .trim()
    .transform((value) => normalizeUrl(value))
    .pipe(z.string().url("Datasheet must be a URL.")),
  sourceUrl: z
    .string()
    .trim()
    .transform((value) => normalizeUrl(value))
    .pipe(z.string().url("Source must be a URL.")),
  sourceRetrievedAt: z.string().min(1, "Retrieval date is required."),
  priceUsd: z.string().trim(),
  tags: z.string().trim(),
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

  // Structured spec inputs (`spec_<metric>` fields) replace the old raw-JSON
  // textarea. Unknown metrics can never be submitted; empty fields are
  // omitted before validation.
  const specsValue = specsFromFormEntries((name) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : null;
  });

  if (
    !specsValue ||
    typeof specsValue !== "object" ||
    Object.keys(specsValue).length === 0
  ) {
    return { error: "Add at least one spec — empty specs cannot be scored." };
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

const proposeSchema = z.object({
  request: z.string().trim().min(10, "Describe what to add in a few words."),
  categoryHint: z.string().trim().optional(),
  sourceUrl: z.string().trim().optional(),
  pastedText: z.string().trim().max(20000).optional(),
});

export async function proposeCatalogPartsAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const parsed = proposeSchema.safeParse({
    request: formData.get("request"),
    categoryHint: formData.get("categoryHint") || undefined,
    sourceUrl: formData.get("sourceUrl") || undefined,
    pastedText: formData.get("pastedText") || undefined,
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the request.");
  }

  // Link-first grounding: fetch a pasted manufacturer/datasheet URL and hand
  // the extracted text to the model alongside the request. PDFs cannot be
  // read this way — pasted text covers those.
  let request = parsed.data.request;
  let fetchNote: string | null = null;
  if (parsed.data.sourceUrl) {
    const fetched = await fetchPageText(parsed.data.sourceUrl);
    if ("text" in fetched) {
      request = [
        parsed.data.request,
        "",
        `Reference page (${fetched.url}):`,
        fetched.text,
      ].join("\n");
    } else {
      fetchNote = fetched.error;
    }
  }
  if (parsed.data.pastedText) {
    request = `${request}\n\nPasted reference text:\n${parsed.data.pastedText}`;
  }

  const categoryHint =
    parsed.data.categoryHint && isCatalogCategory(parsed.data.categoryHint)
      ? parsed.data.categoryHint
      : null;

  let text: string;
  try {
    text = await suggestCatalogParts({ request, categoryHint });
  } catch (error) {
    if (error instanceof Error && error.message.includes("AI_API_KEY")) {
      return fail("Set AI_API_KEY in .env to propose parts with the AI.");
    }
    if (
      error instanceof Error &&
      error.message.startsWith("ai_empty_reply") &&
      error.message.includes("finish_reason=length")
    ) {
      return fail(
        "The model returned no visible text: it used its whole output budget on hidden reasoning. Raise AI_MAX_TOKENS in .env if your provider allows more, switch to a non-reasoning AI_MODEL, or add the part manually below.",
      );
    }
    return fail(
      error instanceof Error
        ? `The AI call failed: ${error.message.slice(0, 200)}`
        : "The AI could not draft parts right now — try again, or add the row manually below.",
    );
  }

  if (!text.trim()) {
    return fail(
      "The model returned no text. Rephrase the request and try again.",
    );
  }

  return {
    ok: true,
    message: `Here's what the model suggested — verify everything against a datasheet, then copy what you want into the add-part form below.${fetchNote ? ` Link note: ${fetchNote}.` : ""}`,
    rawOutput: truncateRawOutput(text),
  };
}
