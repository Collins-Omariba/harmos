import { Check, ExternalLink, X } from "lucide-react";

import { CandidateStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { isSourceStale, sourceAgeLabel } from "@/lib/catalog/staleness";
import { catalogCategoryLabel } from "@/lib/catalog/types";
import type { ComparisonCandidatePayload } from "@/lib/comparison/types";
import { cn } from "@/lib/utils";

export function ComparisonCandidate({
  payload,
  reason,
}: {
  payload: ComparisonCandidatePayload;
  reason: string;
}) {
  const { part, results, status, score, explanation } = payload;
  const failed = results.filter((result) => !result.passed).length;

  return (
    <article
      className={cn(
        "rounded-lg border bg-card/70",
        status === "pass"
          ? "border-primary/30"
          : status === "review"
            ? "border-accent/30"
            : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="numeric text-sm font-medium text-foreground">
              {part.partNumber}
            </h3>
            <CandidateStatusBadge status={status} />
            {explanation ? (
              <Badge
                variant="outline"
                className="border-border bg-muted/40 font-mono text-[10px] text-muted-foreground"
              >
                AI prose
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {part.manufacturer} · {part.package} ·{" "}
            {catalogCategoryLabel(part.category)}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-foreground/80">
            {part.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
            <a
              href={part.datasheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              Datasheet
              <ExternalLink className="size-3" />
            </a>
            <a
              href={part.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Manufacturer source
              <ExternalLink className="size-3" />
            </a>
            <span className="numeric text-muted-foreground">
              {sourceAgeLabel(part.sourceRetrievedAt)}
            </span>
            {isSourceStale(part.sourceRetrievedAt) ? (
              <span className="numeric rounded-sm border border-accent/35 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                verify before designing
              </span>
            ) : null}
            {part.priceUsd !== null ? (
              <span className="numeric text-muted-foreground">
                ${part.priceUsd.toFixed(2)} indicative
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="numeric text-2xl leading-none text-foreground">
            {score}
            <span className="text-xs text-muted-foreground">/100</span>
          </p>
          <p className="numeric mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {failed === 0 ? "all constraints met" : `${failed} missed`}
          </p>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Constraint results
          </p>
          <ul className="mt-2.5 divide-y divide-border border-y border-border">
            {results.map((result) => (
              <li
                key={result.constraintId}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      result.passed
                        ? "border-primary/35 bg-primary/10 text-primary"
                        : result.kind === "mandatory"
                          ? "border-destructive/35 bg-destructive/10 text-destructive"
                          : "border-accent/35 bg-accent/10 text-accent",
                    )}
                  >
                    {result.passed ? (
                      <Check className="size-2.5" />
                    ) : (
                      <X className="size-2.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs leading-snug text-foreground/90">
                      {result.label}
                    </span>
                    <span className="numeric mt-0.5 block text-[10px] text-muted-foreground">
                      {result.kind === "mandatory" ? "hard" : "preference"} ·{" "}
                      {result.expected} · actual {result.actual}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <p className="numeric text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {explanation ? "Explained verdict" : "Deterministic verdict"}
          </p>
          <p className="mt-2.5 text-xs leading-relaxed text-foreground/80">
            {reason}
          </p>
          {explanation && explanation.verdict !== status ? (
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              The model suggested &ldquo;{explanation.verdict}&rdquo;. The
              deterministic result is authoritative.
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
