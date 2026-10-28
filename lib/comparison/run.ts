import { explainComparison, requirementsForExplain } from "@/lib/ai/tasks/explain_comparison";
import { catalog } from "@/lib/catalog";
import { toDomainConstraint } from "@/lib/comparison/constraints";
import { scoreCandidates } from "@/lib/comparison/scorer";
import {
  buildDeterministicReason,
  buildDeterministicSummary,
  buildExplainComparisonInput,
} from "@/lib/comparison/summary";
import type {
  CandidateExplanation,
  CandidateScore,
  ComparisonCandidatePayload,
} from "@/lib/comparison/types";
import { prisma } from "@/lib/db";

export type RunComparisonInput = {
  projectId: string;
  category: string;
  catalogPartIds: string[];
};

export type RunComparisonOptions = {
  /**
   * Seed and unit-test paths disable the AI call so a comparison can be
   * persisted without a cache entry. The UI leaves this enabled: runTask()
   * returns a cache hit when present and otherwise throws synchronously, in
   * which case the deterministic summary is used.
   */
  useAi?: boolean;
};

export type RunComparisonResult = {
  runId: string;
  summary: string;
  explanationStatus: "deterministic" | "explained" | "explanation_unavailable";
  scores: CandidateScore[];
};

const MAX_CANDIDATES = 8;

export async function runComparison(
  input: RunComparisonInput,
  options: RunComparisonOptions = {},
): Promise<RunComparisonResult> {
  if (input.catalogPartIds.length === 0) {
    throw new Error("comparison_requires_at_least_one_candidate");
  }
  if (input.catalogPartIds.length > MAX_CANDIDATES) {
    throw new Error(`comparison_supports_at_most_${MAX_CANDIDATES}_candidates`);
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: {
      requirements: { orderBy: { id: "asc" } },
      comparisonConstraints: { orderBy: { position: "asc" } },
    },
  });

  if (!project) {
    throw new Error("project_not_found");
  }

  const constraints = project.comparisonConstraints.map(toDomainConstraint);

  if (constraints.length === 0) {
    throw new Error("comparison_has_no_constraints");
  }

  const catalogParts = await catalog.getPartsByIds(input.catalogPartIds);
  const parts = catalogParts.filter((part) => part.category === input.category);

  if (parts.length === 0) {
    throw new Error("no_catalog_candidates_in_category");
  }

  const scores = scoreCandidates(parts, constraints);
  const explainInput = buildExplainComparisonInput(
    requirementsForExplain(project.requirements),
    scores,
  );

  let summary = buildDeterministicSummary(scores);
  let explanationStatus: RunComparisonResult["explanationStatus"] =
    "deterministic";
  const explanations = new Map<string, CandidateExplanation>();

  if (options.useAi !== false) {
    try {
      const explanation = await explainComparison(explainInput);
      summary = explanation.summary;
      explanationStatus = "explained";

      for (const verdict of explanation.verdicts) {
        explanations.set(verdict.partNumber, {
          verdict: verdict.verdict,
          reason: verdict.reason,
        });
      }
    } catch {
      // v0 has no live model path. The deterministic score is complete on its
      // own, so a cache miss must never block a comparison from rendering.
      explanationStatus = "explanation_unavailable";
    }
  }

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.comparisonRun.create({
      data: {
        projectId: project.id,
        category: input.category,
        summary,
        explanationStatus,
        constraintsJson: JSON.stringify(constraints),
      },
    });

    await tx.comparisonCandidate.createMany({
      data: scores.map((score) => {
        const explanation = explanations.get(score.part.partNumber) ?? null;
        const payload: ComparisonCandidatePayload = {
          part: score.part,
          score: score.score,
          status: score.status,
          results: score.results,
          explanation,
        };

        return {
          projectId: project.id,
          runId: created.id,
          catalogPartId: score.part.id,
          partNumber: score.part.partNumber,
          manufacturer: score.part.manufacturer,
          verdict: score.status,
          reason: explanation?.reason ?? buildDeterministicReason(score),
          score: score.score,
          constraintResultsJson: JSON.stringify(score.results),
          dataJson: JSON.stringify(payload),
        };
      }),
    });

    return created;
  });

  return {
    runId: run.id,
    summary,
    explanationStatus,
    scores,
  };
}

export async function defaultCandidateIds(
  category: string,
  limit = 5,
): Promise<string[]> {
  const parts = await catalog.listParts({ category });
  return parts.slice(0, limit).map((part) => part.id);
}
