import { runTextTask, type AiStreamCallback } from "@/lib/ai/client";

/**
 * suggest_catalog_parts
 *
 * Given a request (a description of what to add, or pasted datasheet/source
 * text), the model suggests candidate parts as plain text. The reply is
 * shown to the user verbatim and they transcribe what they want into the
 * add-part form by hand. No JSON, no parsing, no structured output.
 */

export const SUGGEST_CATALOG_PARTS_TASK = "suggest_catalog_parts";

export function buildSuggestCatalogPartsPrompt(input: {
  request: string;
  categoryHint?: string | null;
}): string {
  return [
    "Propose 1-6 real, orderable hardware parts matching the request below.",
    "For each part, give: part number, manufacturer, category, a one-sentence description, package, key specs with units, indicative price in USD if known, and one sentence on why it fits and what to double-check.",
    "Never invent a part number, spec value, or URL. If you are unsure about something, say what to check instead of guessing.",
    "",
    "Request:",
    input.request,
    ...(input.categoryHint ? [`Category hint: ${input.categoryHint}`] : []),
  ].join("\n");
}

export async function suggestCatalogParts(
  input: {
    request: string;
    categoryHint?: string | null;
  },
  opts?: { onDelta?: AiStreamCallback },
): Promise<string> {
  return runTextTask(
    SUGGEST_CATALOG_PARTS_TASK,
    buildSuggestCatalogPartsPrompt(input),
    opts,
  );
}
