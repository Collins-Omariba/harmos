import { AlertTriangle, Copy, HeartPulse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { catalogCategoryLabel, type CatalogPart } from "@/lib/catalog/types";
import { sourceAgeLabel } from "@/lib/catalog/staleness";
import type {
  CatalogHealthIssue,
} from "@/lib/catalog/intelligence";

export function CatalogHealth({
  duplicateGroups,
  healthQueue,
}: {
  duplicateGroups: CatalogPart[][];
  healthQueue: CatalogHealthIssue[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card/70 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Catalog health
          </p>
          <h2 className="mt-1.5 flex items-center gap-2 text-base font-medium text-foreground">
            <HeartPulse className="size-4 text-accent" />
            Review queue
          </h2>
        </div>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {duplicateGroups.length} duplicate groups · {healthQueue.length} refresh candidates
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Copy className="size-3.5 text-accent" />
            Possible duplicates
          </h3>
          {duplicateGroups.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {duplicateGroups.slice(0, 6).map((group) => (
                <li
                  key={group.map((part) => part.id).join(":")}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <p className="numeric text-xs font-medium text-foreground">
                    {group.map((part) => part.partNumber).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {group[0]?.manufacturer} · {group[0] ? catalogCategoryLabel(group[0].category) : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              No near-duplicate part numbers detected.
            </p>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="size-3.5 text-accent" />
            Refresh first
          </h3>
          {healthQueue.length > 0 ? (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {healthQueue.map(({ part, issues }) => (
                <li key={part.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <a
                      href={`#catalog-part-${part.id}`}
                      className="numeric text-xs font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {part.partNumber}
                    </a>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {issues.join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <Badge
                      variant="outline"
                      className="border-border bg-muted/40 font-mono text-[9px] text-muted-foreground"
                    >
                      {part.origin}
                    </Badge>
                    <span className="numeric mt-1 block text-[9px] text-muted-foreground">
                      {sourceAgeLabel(part.sourceRetrievedAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              No stale, sparse, or unpriced rows need attention.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
