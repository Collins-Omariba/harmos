import { z } from "zod";

import { runTask } from "@/lib/ai/client";

/**
 * suggest_catalog_parts
 *
 * The catalog growth engine. Given a request — either a description of what
 * to add ("low-power LDOs under $1") or pasted datasheet/source text — the
 * model drafts complete catalog candidates. Every candidate is validated
 * before anything is stored: known category, known spec keys, finite numbers,
 * real-looking URLs. Invalid candidates are reported, never saved. Approved
 * proposals become catalog rows with origin "agent".
 */

export const suggestCatalogPartsInputSchema = z.object({
  request: z.string(),
  categoryHint: z.string().nullable(),
  knownMetrics: z.array(z.string()),
  knownCategories: z.array(z.string()),
  existingPartNumbers: z.array(z.string()),
});

const candidateSchema = z.object({
  partNumber: z.string().min(1),
  manufacturer: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  package: z.string().min(1),
  datasheetUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  specs: z.record(z.string(), z.unknown()),
  priceUsd: z.number().nullable(),
  tags: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().min(1),
});

export const suggestCatalogPartsOutputSchema = z.object({
  candidates: z.array(candidateSchema),
});

export type SuggestCatalogPartsOutput = z.infer<
  typeof suggestCatalogPartsOutputSchema
>;

export type CatalogCandidateDraft = z.infer<typeof candidateSchema>;

export const SUGGEST_CATALOG_PARTS_TASK = "suggest_catalog_parts";

export function buildSuggestCatalogPartsPrompt(input: {
  request: string;
  categoryHint: string | null;
  knownMetrics: string[];
  knownCategories: string[];
  existingPartNumbers: string[];
}): string {
  return [
    "You are drafting catalog entries for a hardware component catalog.",
    "Propose 1-6 REAL parts matching the request below. Use ONLY these rules:",
    "- You can browse the live web: use it to verify every part exists and to confirm each spec number from a manufacturer datasheet or product page before writing it down. Never transcribe a spec from memory when browsing is available.",
    "- Every part must be a real, orderable component you confirmed via browsing. If browsing yields nothing usable, say so by returning an empty candidate list rather than inventing parts.",
    "- If the web is unreachable for a spec, include the part anyway with the specs you do know, confidence low or medium, and a note naming exactly what to verify.",
    "- Spec keys MUST come only from the known list, with the exact units those keys imply (e.g. supplyMinV in volts, quiescentCurrentA in amps, rangeM in meters). Never invent a spec key.",
    "- category MUST be one of the known categories. Use categoryHint when it fits.",
    "- datasheetUrl/sourceUrl must be manufacturer or distributor product pages you are confident exist. If you do not know a real URL, use null — never invent one.",
    "- tags: short lowercase keywords.",
    "- description: one factual sentence.",
    "- note: one sentence on why this part fits and what to double-check.",
    "- Do not propose part numbers already in the existing list.",
    "Return JSON with this exact shape:",
    '{"candidates": [{"partNumber": string, "manufacturer": string, "category": string, "description": string, "package": string, "datasheetUrl": string|null, "sourceUrl": string|null, "specs": object, "priceUsd": number|null, "tags": string[], "confidence": "high"|"medium"|"low", "note": string}]}',
    "",
    "Request:",
    input.request,
    ...(input.categoryHint ? [`Category hint: ${input.categoryHint}`] : []),
    "",
    "Known spec keys:",
    JSON.stringify(input.knownMetrics),
    "",
    "Known categories:",
    JSON.stringify(input.knownCategories),
    "",
    "Already in the catalog (do not repeat):",
    JSON.stringify(input.existingPartNumbers.slice(0, 150)),
  ].join("\n");
}

export async function suggestCatalogParts(input: {
  request: string;
  categoryHint: string | null;
  knownMetrics: string[];
  knownCategories: string[];
  existingPartNumbers: string[];
}): Promise<SuggestCatalogPartsOutput> {
  return runTask(
    SUGGEST_CATALOG_PARTS_TASK,
    suggestCatalogPartsInputSchema,
    suggestCatalogPartsOutputSchema,
    buildSuggestCatalogPartsPrompt(input),
    { webSearch: true },
  );
}
