import { z } from "zod";

import { runTask } from "@/lib/ai/client";
import type {
  ExplainComparisonInput,
  ExplainComparisonRequirement,
} from "@/lib/comparison/types";

/**
 * explain_comparison
 *
 * The scorer has already decided pass/review/fail. This task only writes a
 * trade-off summary and a short reason per candidate. It is structured output,
 * disk-cached, and logged by lib/ai/client.ts like every other AI task.
 */

export const explainComparisonInputSchema = z.object({
  requirements: z.array(
    z.object({
      text: z.string(),
      kind: z.string(),
      status: z.string(),
    }),
  ),
  candidates: z.array(
    z.object({
      partNumber: z.string(),
      manufacturer: z.string(),
      category: z.string(),
      score: z.number(),
      status: z.enum(["pass", "review", "fail"]),
      constraints: z.array(
        z.object({
          label: z.string(),
          kind: z.enum(["mandatory", "preference"]),
          expected: z.string(),
          actual: z.string(),
          passed: z.boolean(),
        }),
      ),
    }),
  ),
});

export const explainComparisonOutputSchema = z.object({
  summary: z.string().min(1),
  verdicts: z.array(
    z.object({
      partNumber: z.string().min(1),
      verdict: z.enum(["pass", "review", "fail"]),
      reason: z.string().min(1),
    }),
  ),
});

export type ExplainComparisonOutput = z.infer<
  typeof explainComparisonOutputSchema
>;

export const EXPLAIN_COMPARISON_TASK = "explain_comparison";

export function buildExplainComparisonPrompt(
  input: ExplainComparisonInput,
): string {
  return [
    "You are explaining a component comparison for a hardware engineering workspace.",
    "The pass/review/fail status and the 0-100 score below were computed deterministically in code.",
    "Never change or recompute those statuses. Never invent specifications that are not in the input.",
    "Do not recommend a part that failed a mandatory constraint as if it passed.",
    "Write a concise trade-off summary and one short verdict reason per candidate.",
    "Return JSON with this exact shape:",
    '{"summary": string, "verdicts": [{"partNumber": string, "verdict": "pass" | "review" | "fail", "reason": string}]}',
    "",
    "Project requirements:",
    JSON.stringify(input.requirements, null, 2),
    "",
    "Candidates and deterministic constraint results:",
    JSON.stringify(input.candidates, null, 2),
  ].join("\n");
}

export async function explainComparison(
  input: ExplainComparisonInput,
): Promise<ExplainComparisonOutput> {
  return runTask(
    EXPLAIN_COMPARISON_TASK,
    explainComparisonInputSchema,
    explainComparisonOutputSchema,
    buildExplainComparisonPrompt(input),
  );
}

export function requirementsForExplain(
  requirements: {
    text: string;
    kind: string;
    status: string;
  }[],
): ExplainComparisonRequirement[] {
  return requirements.map((requirement) => ({
    text: requirement.text,
    kind: requirement.kind,
    status: requirement.status,
  }));
}
