import { z } from "zod";

import { runTask } from "@/lib/ai/client";

/**
 * explain_change_impact
 *
 * Code has already computed the ripple. This task only explains that exact
 * set in plain language. Returned artifact ids are filtered back to the
 * computed set before display, so the model can neither add nor remove
 * affected artifacts. Structured output, disk-cached, and logged.
 */

const nodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
});

const edgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.string(),
});

export const explainChangeImpactInputSchema = z.object({
  componentSwap: z.object({
    projectName: z.string(),
    from: nodeSchema,
    to: nodeSchema,
  }),
  edges: z.array(edgeSchema),
  affectedArtifacts: z.array(
    nodeSchema.extend({
      depth: z.number(),
      path: z.array(z.string()),
    }),
  ),
});

export const explainChangeImpactOutputSchema = z.object({
  affectedArtifactIds: z.array(z.string()),
  reasoning: z.string().min(1),
});

export type ExplainChangeImpactInput = z.infer<
  typeof explainChangeImpactInputSchema
>;
export type ExplainChangeImpactOutput = z.infer<
  typeof explainChangeImpactOutputSchema
>;

export const EXPLAIN_CHANGE_IMPACT_TASK = "explain_change_impact";

export function buildExplainChangeImpactPrompt(
  input: ExplainChangeImpactInput,
): string {
  return [
    "You are explaining the impact of a component swap in a hardware project.",
    "The affected artifacts below were computed by traversing the project's dependency graph in code.",
    "Use ONLY that computed set. Never add, remove, rename, or reorder affected artifacts.",
    "Explain in plain language what should be rechecked, in dependency order, and why the swap reaches each item.",
    "Do not claim the change is safe. Mention direct effects before downstream effects.",
    "Return JSON with this exact shape:",
    '{"affectedArtifactIds": string[], "reasoning": string}',
    "affectedArtifactIds must contain exactly the ids from the computed set.",
    "",
    "Component swap:",
    JSON.stringify(input.componentSwap, null, 2),
    "",
    "Dependency edges traversed (labels):",
    JSON.stringify(input.edges, null, 2),
    "",
    "Computed affected artifacts:",
    JSON.stringify(input.affectedArtifacts, null, 2),
  ].join("\n");
}

export async function explainChangeImpact(
  input: ExplainChangeImpactInput,
): Promise<ExplainChangeImpactOutput> {
  const result = await runTask(
    EXPLAIN_CHANGE_IMPACT_TASK,
    explainChangeImpactInputSchema,
    explainChangeImpactOutputSchema,
    buildExplainChangeImpactPrompt(input),
  );

  const computedIds = input.affectedArtifacts.map((artifact) => artifact.id);

  return {
    // The computed set is authoritative even if the model returns a subset,
    // a different order, duplicates, or ids that were never computed.
    affectedArtifactIds: computedIds,
    reasoning: result.reasoning,
  };
}
