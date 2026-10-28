import { z } from "zod";

import { runTask } from "@/lib/ai/client";
import type { ConstraintSuggestion } from "@/lib/comparison/suggest";

/**
 * suggest_constraints
 *
 * The scorer has already been given the user's chosen packs. This task only
 * proposes additional constraints the user may want; every suggestion must
 * reference a known metric and category, and the user confirms each one
 * before anything is stored. Structured output, disk-cached, logged.
 */

export const suggestConstraintsInputSchema = z.object({
  brief: z.string(),
  packIds: z.array(z.string()),
  chosen: z.array(
    z.object({
      label: z.string(),
      metric: z.string(),
      operator: z.string(),
      kind: z.string(),
    }),
  ),
  metrics: z.array(z.string()),
  categories: z.array(z.string()),
});

export const suggestConstraintsOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      label: z.string().min(1),
      metric: z.string().min(1),
      operator: z.enum([
        "gte",
        "lte",
        "gt",
        "lt",
        "eq",
        "neq",
        "includes",
        "covers",
      ]),
      value: z.union([z.number(), z.string()]),
      unit: z.string().nullable(),
      kind: z.enum(["mandatory", "preference"]),
      appliesTo: z.array(z.string()),
      reason: z.string().min(1),
    }),
  ),
});

export type SuggestConstraintsOutput = z.infer<
  typeof suggestConstraintsOutputSchema
>;

export const SUGGEST_CONSTRAINTS_TASK = "suggest_constraints";

export function buildSuggestConstraintsPrompt(input: {
  brief: string;
  packIds: string[];
  chosen: { label: string; metric: string; operator: string; kind: string }[];
  metrics: string[];
  categories: string[];
}): string {
  return [
    "You are helping configure hardware constraints for an engineering workspace.",
    "The user already chose constraint packs; propose 2-5 ADDITIONAL constraints they likely need.",
    "Rules:",
    "- Use only metrics from the known list and only these operators: gte, lte, gt, lt, eq, neq, includes, covers.",
    "- Use only categories from the known list in appliesTo; empty array means all categories.",
    "- Never repeat a chosen metric+operator pair.",
    "- Prefer preference kind unless the brief clearly demands a hard limit.",
    "- One sentence reason per suggestion, grounded in the brief or the chosen packs.",
    "Return JSON with this exact shape:",
    '{"suggestions": [{"label": string, "metric": string, "operator": ..., "value": number|string, "unit": string|null, "kind": "mandatory"|"preference", "appliesTo": string[], "reason": string}]}',
    "",
    "Project brief:",
    input.brief,
    "",
    "Chosen pack ids:",
    JSON.stringify(input.packIds),
    "",
    "Already-chosen constraints (do not repeat these metric+operator pairs):",
    JSON.stringify(input.chosen, null, 2),
    "",
    "Known metrics:",
    JSON.stringify(input.metrics),
    "",
    "Known categories:",
    JSON.stringify(input.categories),
  ].join("\n");
}

export async function suggestConstraints(
  input: {
    brief: string;
    packIds: string[];
    chosen: { label: string; metric: string; operator: string; kind: string }[];
    metrics: string[];
    categories: string[];
  },
  fallback: ConstraintSuggestion[],
): Promise<{ suggestions: ConstraintSuggestion[]; source: "ai" | "rules" }> {
  try {
    const result = await runTask(
      SUGGEST_CONSTRAINTS_TASK,
      suggestConstraintsInputSchema,
      suggestConstraintsOutputSchema,
      buildSuggestConstraintsPrompt(input),
    );

    const seen = new Set(
      input.chosen.map((c) => `${c.metric}+${c.operator}`),
    );
    const suggestions = result.suggestions.filter((suggestion) => {
      if (!input.metrics.includes(suggestion.metric)) return false;
      if (
        suggestion.appliesTo.some((c) => !input.categories.includes(c))
      )
        return false;
      const key = `${suggestion.metric}+${suggestion.operator}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { suggestions, source: "ai" };
  } catch {
    return { suggestions: fallback, source: "rules" };
  }
}
