import type {
  CandidateScore,
  ExplainComparisonCandidate,
  ExplainComparisonInput,
  ExplainComparisonRequirement,
} from "@/lib/comparison/types";
import { countByStatus } from "@/lib/comparison/scorer";

function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function firstFailure(
  score: CandidateScore,
  kind: "mandatory" | "preference",
) {
  return score.results.find(
    (result) => result.kind === kind && !result.passed && !result.skipped,
  );
}

function skippedNote(score: CandidateScore): string {
  return score.skipped > 0
    ? ` ${score.skipped} ${score.skipped === 1 ? "constraint does" : "constraints do"} not apply to this category.`
    : "";
}

export function buildDeterministicReason(score: CandidateScore): string {
  if (score.status === "fail") {
    const failure = firstFailure(score, "mandatory");
    const base = failure
      ? `Fails mandatory constraint "${failure.label}" (needs ${failure.expected}, has ${failure.actual}).`
      : "Fails at least one mandatory constraint.";

    return `${base} Passes ${score.mandatoryPassed} of ${score.mandatoryTotal} mandatory and ${score.preferencePassed} of ${score.preferenceTotal} preference constraints.${skippedNote(score)} Deterministic score ${score.score}/100.`;
  }

  if (score.status === "review") {
    const failure = firstFailure(score, "preference");
    const base = failure
      ? `Meets every mandatory constraint but misses preference "${failure.label}" (needs ${failure.expected}, has ${failure.actual}).`
      : "Meets every mandatory constraint but misses at least one preference.";

    return `${base}${skippedNote(score)} Deterministic score ${score.score}/100.`;
  }

  return `Meets all ${plural(score.mandatoryTotal + score.preferenceTotal, "constraint")}.${skippedNote(score)} Deterministic score ${score.score}/100.`;
}

export function buildDeterministicSummary(scores: CandidateScore[]): string {
  if (scores.length === 0) {
    return "No catalog candidates were selected for this comparison.";
  }

  const counts = countByStatus(scores);
  const leader = scores[0];
  const parts = [
    `${plural(scores.length, "candidate")} scored against the project constraints.`,
    `${counts.pass} pass, ${counts.review} need review, and ${counts.fail} fail.`,
  ];

  if (leader) {
    parts.push(
      `${leader.part.partNumber} ranks first with a deterministic score of ${leader.score}/100.`,
    );
  }

  const failing = scores.filter((score) => score.status === "fail").slice(0, 3);
  if (failing.length > 0) {
    const reasons = failing.map((score) => {
      const failure = firstFailure(score, "mandatory");
      return failure
        ? `${score.part.partNumber} fails "${failure.label}"`
        : `${score.part.partNumber} fails a mandatory constraint`;
    });
    parts.push(`${reasons.join("; ")}.`);
  }

  return parts.join(" ");
}

export function buildExplainComparisonInput(
  requirements: ExplainComparisonRequirement[],
  scores: CandidateScore[],
): ExplainComparisonInput {
  const candidates: ExplainComparisonCandidate[] = scores.map((score) => ({
    partNumber: score.part.partNumber,
    manufacturer: score.part.manufacturer,
    category: score.part.category,
    score: score.score,
    status: score.status,
    constraints: score.results.map((result) => ({
      label: result.label,
      kind: result.kind,
      expected: result.expected,
      actual: result.actual,
      passed: result.passed,
    })),
  }));

  return { requirements, candidates };
}
