"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runComparison } from "@/lib/comparison/run";

const runComparisonSchema = z.object({
  category: z.string().min(1, "Choose a catalog category."),
  catalogPartIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one candidate.")
    .max(8, "Select no more than eight candidates."),
});

export type ComparisonActionState = {
  ok: boolean;
  message: string;
} | null;

export async function runComparisonAction(
  projectId: string,
  _previous: ComparisonActionState,
  formData: FormData,
): Promise<ComparisonActionState> {
  const parsed = runComparisonSchema.safeParse({
    category: formData.get("category"),
    catalogPartIds: formData.getAll("catalogPartIds"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the comparison inputs.",
    };
  }

  try {
    const result = await runComparison({
      projectId,
      category: parsed.data.category,
      catalogPartIds: parsed.data.catalogPartIds,
    });

    revalidatePath(`/projects/${projectId}`);

    return {
      ok: true,
      message: `Scored ${result.scores.length} candidates. ${result.explanationStatus === "explained" ? "AI explanation included." : "Showing the auto summary; set AI_API_KEY for AI explanations."}`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message.replaceAll("_", " ")
          : "Could not run the comparison.",
    };
  }
}
