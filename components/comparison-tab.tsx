import { FlaskConical, Scale } from "lucide-react";

import { DraftMissingPartButton } from "@/components/catalog-gap-actions";
import { ComparisonCandidate } from "@/components/comparison-candidate";
import { ComparisonRunner } from "@/components/comparison-runner";
import { ConstraintManager } from "@/components/constraint-manager";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { analyzeCatalogGaps } from "@/lib/catalog/intelligence";
import { catalogCategoryLabel, type CatalogPart } from "@/lib/catalog/types";
import { parseCandidatePayload } from "@/lib/comparison/constraints";
import type {
  CandidateStatus,
  ComparisonConstraint,
} from "@/lib/comparison/types";
import { formatDate, padCount } from "@/lib/format";

type CandidateRow = {
  id: string;
  catalogPartId: string | null;
  partNumber: string;
  manufacturer: string;
  verdict: string;
  reason: string;
  score: number;
  dataJson: string;
};

type RunRow = {
  id: string;
  category: string;
  summary: string;
  explanationStatus: string;
  createdAt: Date;
  candidates: CandidateRow[];
};

type ComparisonTabProps = {
  projectId: string;
  constraints: ComparisonConstraint[];
  run: RunRow | null;
  catalogParts: CatalogPart[];
  categories: { key: string; label: string; description: string }[];
  existingPartNumbers: string[];
};

const statusRank: Record<CandidateStatus, number> = {
  pass: 0,
  review: 1,
  fail: 2,
};

function explanationLabel(status: string): string {
  if (status === "explained") {
    return "Explained by AI";
  }
  if (status === "deterministic") {
    return "Auto summary";
  }
  return "AI unavailable";
}

export function ComparisonTab({
  projectId,
  constraints,
  run,
  catalogParts,
  categories,
  existingPartNumbers,
}: ComparisonTabProps) {
  const inBom = new Set(existingPartNumbers);
  const candidates = (run?.candidates ?? [])
    .map((candidate) => ({
      candidate,
      payload: parseCandidatePayload(candidate.dataJson),
    }))
    .filter(
      (
        entry,
      ): entry is {
        candidate: CandidateRow;
        payload: NonNullable<ReturnType<typeof parseCandidatePayload>>;
      } => entry.payload !== null,
    )
    .sort((a, b) => {
      const rank = statusRank[a.payload.status] - statusRank[b.payload.status];
      return rank !== 0 ? rank : b.payload.score - a.payload.score;
    });

  const counts = candidates.reduce(
    (totals, { payload }) => {
      totals[payload.status] += 1;
      return totals;
    },
    { pass: 0, review: 0, fail: 0 },
  );

  const catalogGaps = analyzeCatalogGaps(constraints, catalogParts);
  const defaultCategory = run?.category ?? categories[0]?.key ?? "level-sensor";
  const defaultPartIds = (run?.candidates ?? [])
    .map((candidate) => candidate.catalogPartId)
    .filter((id): id is string => Boolean(id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Deterministic scoring
          </p>
          <h2 className="mt-1.5 text-base font-medium text-foreground">
            Candidate comparison
          </h2>
        </div>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {padCount(candidates.length)} candidates · {padCount(constraints.length)}{" "}
          constraints
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="rounded-lg border border-border bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Constraints
            </p>
            <Scale className="size-3.5 text-accent" />
          </div>
          <div className="mt-4">
            <ConstraintManager projectId={projectId} constraints={constraints} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Latest run
            </p>
            {run ? (
              <Badge
                variant="outline"
                className={
                  run.explanationStatus === "explained"
                    ? "border-primary/35 bg-primary/10 font-mono text-[10px] text-primary"
                    : "border-border bg-muted/40 font-mono text-[10px] text-muted-foreground"
                }
              >
                {explanationLabel(run.explanationStatus)}
              </Badge>
            ) : null}
          </div>

          {run ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <span className="numeric text-xs text-foreground">
                    {counts.pass} pass
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-accent" />
                  <span className="numeric text-xs text-foreground">
                    {counts.review} review
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  <span className="numeric text-xs text-foreground">
                    {counts.fail} fail
                  </span>
                </div>
                <span className="numeric ml-auto text-[10px] text-muted-foreground">
                  {formatDate(run.createdAt)}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-foreground/85">
                {run.summary}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FlaskConical className="size-3 text-accent" />
                Scores are worked out exactly, not guessed. The AI only writes
                the explanation.
              </p>
            </>
          ) : (
            <div className="mt-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                This project has no comparison run yet. Choose a catalog
                category and candidates below to score them against the stored
                constraints.
              </p>
            </div>
          )}
        </div>
      </div>

      {candidates.length > 0 ? (
        <div className="space-y-3">
          {candidates.map(({ candidate, payload }) => (
            <ComparisonCandidate
              key={candidate.id}
              payload={payload}
              reason={candidate.reason}
              projectId={projectId}
              inBom={inBom.has(payload.part.partNumber)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Scale}
          title="No comparison results"
          description="Run a deterministic comparison to score catalog candidates against this project's hard constraints."
        />
      )}

      <ComparisonRunner
        projectId={projectId}
        categories={categories}
        parts={catalogParts}
        defaultCategory={defaultCategory}
        defaultPartIds={defaultPartIds}
      />

      <section className="rounded-lg border border-border bg-card/70 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Catalog coverage
            </p>
            <h3 className="mt-1.5 text-base font-medium text-foreground">
              Gaps against these constraints
            </h3>
          </div>
          <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {catalogGaps.filter((gap) => gap.gapCategories.length > 0).length} gaps
          </span>
        </div>

        {catalogGaps.length > 0 ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {catalogGaps.map((gap) => (
              <li key={gap.constraint.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{gap.constraint.label}</p>
                    <p className="numeric mt-0.5 text-[10px] text-muted-foreground">
                      {gap.totalPassing} catalog parts pass this constraint
                    </p>
                  </div>
                  {gap.gapCategories.length === 0 ? (
                    <Badge variant="outline" className="border-primary/35 bg-primary/10 font-mono text-[9px] text-primary">
                      covered
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/35 bg-destructive/10 font-mono text-[9px] text-destructive">
                      missing coverage
                    </Badge>
                  )}
                </div>
                {gap.gapCategories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gap.gapCategories.map((category) => (
                      <span key={category} className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1">
                        <span className="text-[11px] text-muted-foreground">{catalogCategoryLabel(category)}</span>
                        <DraftMissingPartButton category={category} constraintLabel={gap.constraint.label} />
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Add constraints to analyze catalog coverage.</p>
        )}
      </section>
    </div>
  );
}
