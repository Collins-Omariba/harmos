import { z } from "zod";

import { runTask } from "@/lib/ai/client";

/**
 * select_resources
 *
 * Chooses resource ids from a pre-indexed local list only. The index is
 * built in code from the project's stored resources; the model never sees
 * the open web and can never invent a URL. Every returned id is validated
 * against the index before anything is stored, so a hallucinating model
 * degrades to an empty selection instead of corrupt data. Structured output,
 * disk-cached, logged.
 */

export type ResourceIndexEntry = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  tags: string[];
};

export const selectResourcesInputSchema = z.object({
  project: z.object({
    name: z.string(),
    brief: z.string(),
  }),
  requirements: z.array(
    z.object({
      text: z.string(),
      kind: z.string(),
      status: z.string(),
    }),
  ),
  index: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      kind: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
    }),
  ),
});

export const selectResourcesOutputSchema = z.object({
  selections: z.array(
    z.object({
      id: z.string().min(1),
      note: z.string().min(1),
    }),
  ),
});

export type SelectResourcesOutput = z.infer<
  typeof selectResourcesOutputSchema
>;

export const SELECT_RESOURCES_TASK = "select_resources";

export function buildSelectResourcesPrompt(input: {
  project: { name: string; brief: string };
  requirements: { text: string; kind: string; status: string }[];
  index: ResourceIndexEntry[];
}): string {
  return [
    "You are selecting reference material for a hardware engineering workspace.",
    "Choose ONLY ids from the pre-indexed list below. Never invent a source, a URL, or an id that is not listed.",
    "Prefer datasheets for parts under comparison, then app notes and standards that settle an open requirement.",
    "Skip marketing pages and anything irrelevant to the brief. Fewer, better sources beat a long list.",
    "Return JSON with this exact shape:",
    '{"selections": [{"id": string, "note": string}]}',
    "where note is one sentence on why this source matters to this project.",
    "",
    "Project:",
    `${input.project.name} — ${input.project.brief}`,
    "",
    "Requirements:",
    JSON.stringify(input.requirements, null, 2),
    "",
    "Pre-indexed resources (the ONLY ids you may return):",
    JSON.stringify(input.index, null, 2),
  ].join("\n");
}

export async function selectResources(input: {
  project: { name: string; brief: string };
  requirements: { text: string; kind: string; status: string }[];
  index: ResourceIndexEntry[];
}): Promise<{ selections: { id: string; note: string }[] }> {
  const result = await runTask(
    SELECT_RESOURCES_TASK,
    selectResourcesInputSchema,
    selectResourcesOutputSchema,
    buildSelectResourcesPrompt(input),
  );

  const known = new Set(input.index.map((entry) => entry.id));
  const seen = new Set<string>();

  return {
    selections: result.selections.filter((selection) => {
      if (!known.has(selection.id) || seen.has(selection.id)) {
        return false;
      }
      seen.add(selection.id);
      return true;
    }),
  };
}
