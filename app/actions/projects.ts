"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assembleProjectFromPacks } from "@/lib/comparison/assemble";
import { suggestConstraints } from "@/lib/ai/tasks/suggest_constraints";
import { catalog, CATALOG_CATEGORY_KEYS } from "@/lib/catalog";
import { COMPARISON_METRICS } from "@/lib/comparison/metrics";
import { PACK_MAP } from "@/lib/comparison/packs";
import { defaultCandidateIds, runComparison } from "@/lib/comparison/run";
import { scoreCandidates } from "@/lib/comparison/scorer";
import { suggestConstraints as suggestFromRules } from "@/lib/comparison/suggest";
import type { ComparisonConstraint } from "@/lib/comparison/types";
import { prisma } from "@/lib/db";

const newProjectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  brief: z.string().trim().min(20, "Brief must be at least 20 characters."),
  packIds: z.array(z.string()).default([]),
  extras: z
    .array(
      z.object({
        label: z.string().trim().min(4),
        metric: z.string().min(1),
        operator: z.string().min(1),
        value: z.union([z.number(), z.string()]),
        unit: z.string().max(12).nullable(),
        kind: z.enum(["mandatory", "preference"]),
        appliesTo: z.array(z.string()),
      }),
    )
    .default([]),
});

export type SuggestState = {
  suggestions: {
    label: string;
    metric: string;
    operator: string;
    value: number | string;
    unit: string | null;
    kind: string;
    appliesTo: string[];
    reason: string;
  }[];
  source: "ai" | "rules";
  error?: string;
};

export async function suggestConstraintsAction(input: {
  brief: string;
  packIds: string[];
}): Promise<SuggestState> {
  const brief = (input.brief ?? "").trim();
  const packIds = [...new Set(input.packIds ?? [])].filter((id) =>
    PACK_MAP.has(id),
  );

  if (brief.length < 10) {
    return { suggestions: [], source: "rules", error: "Write a few words of brief first." };
  }

  const chosen = packIds.flatMap((id) => {
    const option = PACK_MAP.get(id);
    return (option?.constraints ?? []).map((constraint) => ({
      label: constraint.label,
      metric: constraint.metric,
      operator: constraint.operator,
      kind: constraint.kind,
    }));
  });

  const fallback = suggestFromRules({ brief, packIds });

  try {
    const result = await suggestConstraints(
      {
        brief,
        packIds,
        chosen,
        metrics: COMPARISON_METRICS.map((metric) => metric.metric),
        categories: [...CATALOG_CATEGORY_KEYS],
      },
      fallback,
    );

    return {
      suggestions: result.suggestions.map((suggestion) => ({
        ...suggestion,
        operator: suggestion.operator as string,
        kind: suggestion.kind as string,
      })),
      source: result.source,
      error: result.error ? friendlyAiError(result.error) : undefined,
    };
  } catch {
    return {
      suggestions: fallback,
      source: "rules",
    };
  }
}

function friendlyAiError(raw: string): string {
  if (raw.includes("AI_API_KEY is not configured")) {
    return "Add your AI key in .env to enable AI suggestions — showing rule-based ones for now.";
  }
  if (raw.includes("demo_mode_cache_miss")) {
    return "Demo mode is on, so no AI call was made — showing rule-based suggestions.";
  }
  if (raw.startsWith("ai_invalid_")) {
    return "The AI reply came back in the wrong shape — showing rule-based suggestions instead.";
  }
  if (raw.includes("web_search_")) {
    return raw;
  }
  return "The AI call failed — showing rule-based suggestions instead.";
}

export type NewProjectState = {
  error?: string;
} | null;

export async function createProjectWithPacksAction(input: {
  name: string;
  brief: string;
  packIds: string[];
  extras: z.infer<typeof newProjectSchema>["extras"];
}): Promise<NewProjectState> {
  const parsed = newProjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the project details.",
    };
  }

  const assembled = assembleProjectFromPacks({
    name: parsed.data.name,
    brief: parsed.data.brief,
    packIds: parsed.data.packIds,
    extras: parsed.data.extras,
  });

  if ("error" in assembled) {
    return { error: assembled.error };
  }

  const projectId = `proj-${crypto.randomUUID()}`;

  try {
    await prisma.project.create({
      data: {
        id: projectId,
        name: parsed.data.name,
        brief: parsed.data.brief,
        status: "draft",
        requirements: { create: assembled.requirements },
        comparisonConstraints: {
          create: assembled.constraints.map((constraint, index) => ({
            label: constraint.label,
            metric: constraint.metric,
            operator: constraint.operator,
            valueJson: JSON.stringify(constraint.value),
            unit: constraint.unit,
            kind: constraint.kind,
            appliesToJson: JSON.stringify(constraint.appliesTo),
            position: index,
          })),
        },
      },
    });
  } catch {
    return { error: "Could not create the project." };
  }

  // First run lands in the most relevant category: the one whose default
  // candidates score highest under the new constraints.
  try {
    await runBestCategory(projectId, assembled.constraints);
  } catch {
    // The project is still usable; the Comparison tab can run any category.
  }

  revalidatePath("/");
  redirect(`/projects/${projectId}?tab=comparison`);
}

async function runBestCategory(
  projectId: string,
  constraints: ComparisonConstraint[],
): Promise<void> {
  if (constraints.length === 0) {
    return;
  }

  let best: { category: string; score: number; applicable: number } | null =
    null;

  for (const category of CATALOG_CATEGORY_KEYS) {
    const parts = (await catalog.listParts({ category })).slice(0, 5);
    if (parts.length === 0) {
      continue;
    }

    const scores = scoreCandidates(parts, constraints);
    const top = scores[0];
    if (!top) {
      continue;
    }
    const applicable =
      top.mandatoryTotal + top.preferenceTotal;

    if (
      !best ||
      top.score > best.score ||
      (top.score === best.score && applicable > best.applicable)
    ) {
      best = { category, score: top.score, applicable };
    }
  }

  if (!best) {
    return;
  }

  const candidateIds = await defaultCandidateIds(best.category, 5);
  await runComparison({
    projectId,
    category: best.category,
    catalogPartIds: candidateIds,
  });
}
