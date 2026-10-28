"use client";

import { useActionState, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";

import {
  approveCatalogProposalAction,
  proposeCatalogPartsAction,
  rejectCatalogProposalAction,
} from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CATALOG_CATEGORIES } from "@/lib/catalog/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field, HiddenFields, TextArea, TextInput } from "@/components/record-dialog";

export type ProposalRow = {
  id: string;
  request: string;
  note: string;
  createdAt: Date;
  candidate: {
    partNumber: string;
    manufacturer: string;
    category: string;
    description: string;
    package: string;
    datasheetUrl: string | null;
    sourceUrl: string | null;
    specs: Record<string, unknown>;
    priceUsd: number | null;
    tags: string[];
    confidence: string;
    note: string;
    warnings: string[];
  } | null;
};

function ProposeForm() {
  const [state, formAction, pending] = useActionState(
    proposeCatalogPartsAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <Field label="Manufacturer or datasheet link (recommended)" htmlFor="proposal-url">
          <TextInput
            id="proposal-url"
            name="sourceUrl"
            type="url"
            placeholder="https://www.ti.com/lit/ds/symlink/…"
          />
        </Field>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Paste the product page and the AI drafts from the real specs instead
          of memory. PDFs cannot be read from a link — paste their text below.
        </p>
      </div>
      <Field label="What should the catalog grow with?" htmlFor="proposal-request">
        <TextArea
          id="proposal-request"
          name="request"
          required
          rows={3}
          placeholder='Low-power LDOs under $1 in SOT-23 — or paste a datasheet excerpt below and say "extract this part"'
        />
      </Field>
      <Field label="Pasted reference text (optional — for PDFs)" htmlFor="proposal-pasted">
        <TextArea
          id="proposal-pasted"
          name="pastedText"
          rows={4}
          placeholder="Copy the spec table or key paragraphs here…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category hint (optional)" htmlFor="proposal-category">
          <select
            id="proposal-category"
            name="categoryHint"
            defaultValue=""
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">Let the AI decide</option>
            {CATALOG_CATEGORIES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {state ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            state.ok
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          {state.message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Sparkles data-icon="inline-start" />
          {pending ? "Drafting…" : "Draft with AI"}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Drafts land below for review. Nothing enters the catalog until you
        approve it — invalid specs, invented URLs, and duplicates are filtered
        out first, and every filter is shown.
      </p>
    </form>
  );
}

export function CatalogProposer({ proposals }: { proposals: ProposalRow[] }) {
  const [, approveAction] = useActionState(approveCatalogProposalAction, null);
  const [, rejectAction] = useActionState(rejectCatalogProposalAction, null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Grow the catalog
          </p>
          <h2 className="mt-1.5 text-base font-medium text-foreground">
            Propose parts with AI
          </h2>
        </div>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {proposals.length} awaiting review
        </span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Sparkles data-icon="inline-start" />
            New proposal
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Propose catalog parts</DialogTitle>
            <DialogDescription>
              Describe what to add, or paste source text to extract.
            </DialogDescription>
          </DialogHeader>
          <ProposeForm />
        </DialogContent>
      </Dialog>

      {proposals.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="py-3">
              {proposal.candidate ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {proposal.candidate.partNumber}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {proposal.candidate.manufacturer} ·{" "}
                        {proposal.candidate.category}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {proposal.candidate.description}
                    </p>
                    <p className="numeric mt-1 text-[11px] text-muted-foreground">
                      {Object.keys(proposal.candidate.specs).length} specs ·{" "}
                      {proposal.candidate.priceUsd !== null
                        ? `$${proposal.candidate.priceUsd.toFixed(2)}`
                        : "price unknown"}{" "}
                      · confidence {proposal.candidate.confidence}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
                      {proposal.candidate.note}
                    </p>
                    {proposal.candidate.warnings.length > 0 ||
                    proposal.note ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-accent">
                        {[proposal.note, ...proposal.candidate.warnings]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    ) : null}
                    {!proposal.candidate.datasheetUrl ? (
                      <p className="mt-1 text-[11px] text-destructive">
                        No datasheet URL — approval is blocked until one is
                        added. Add the part manually instead.
                      </p>
                    ) : null}
                    <p className="numeric mt-1 text-[10px] text-muted-foreground">
                      proposed {formatDate(proposal.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <form action={approveAction}>
                      <HiddenFields fields={{ recordId: proposal.id }} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        title="Validate once more and add to the catalog"
                      >
                        <Check data-icon="inline-start" />
                        Approve
                      </Button>
                    </form>
                    <form action={rejectAction}>
                      <HiddenFields fields={{ recordId: proposal.id }} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        <X data-icon="inline-start" />
                        Reject
                      </Button>
                    </form>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-destructive">
                  Proposal data is unreadable — reject it.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          The review queue is empty. Describe what the catalog is missing above
          and the AI will draft entries for your approval.
        </p>
      )}
    </div>
  );
}
