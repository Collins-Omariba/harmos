"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  constraintsFromPreset,
  getComparisonPreset,
  requirementsFromPreset,
} from "@/lib/comparison/presets";
import { defaultCandidateIds, runComparison } from "@/lib/comparison/run";
import { prisma } from "@/lib/db";

const newProjectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  brief: z.string().trim().min(20, "Brief must be at least 20 characters."),
  preset: z.string().min(1, "Choose a comparison preset."),
});

export type NewProjectState = {
  error?: string;
} | null;

export async function createProjectAction(
  _previous: NewProjectState,
  formData: FormData,
): Promise<NewProjectState> {
  const parsed = newProjectSchema.safeParse({
    name: formData.get("name"),
    brief: formData.get("brief"),
    preset: formData.get("preset"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the project details.",
    };
  }

  const preset = getComparisonPreset(parsed.data.preset);

  if (!preset) {
    return { error: "Unknown comparison preset." };
  }

  const projectId = `proj-${crypto.randomUUID()}`;
  const constraints = constraintsFromPreset(preset, projectId);

  try {
    await prisma.project.create({
      data: {
        id: projectId,
        name: parsed.data.name,
        brief: parsed.data.brief,
        status: "draft",
        requirements: {
          create: requirementsFromPreset(preset),
        },
        comparisonConstraints: {
          create: constraints.map((constraint) => ({
            id: constraint.id,
            label: constraint.label,
            metric: constraint.metric,
            operator: constraint.operator,
            valueJson: JSON.stringify(constraint.value),
            unit: constraint.unit,
            kind: constraint.kind,
            position: constraint.position,
          })),
        },
      },
    });
  } catch {
    return { error: "Could not create the project." };
  }

  try {
    const candidateIds = await defaultCandidateIds(preset.key, 5);
    await runComparison(
      {
        projectId,
        category: preset.key,
        catalogPartIds: candidateIds,
      },
      { useAi: false },
    );
  } catch {
    // The project is still usable without a first comparison; the Comparison
    // tab can run one once the catalog is seeded.
  }

  revalidatePath("/");
  redirect(`/projects/${projectId}?tab=comparison`);
}
