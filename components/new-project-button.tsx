"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";

import {
  createProjectWithPacksAction,
  suggestConstraintsAction,
  type SuggestState,
} from "@/app/actions/projects";
import { AiProgress, useElapsedSeconds } from "@/components/ai-progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PACK_DIMENSIONS } from "@/lib/comparison/packs";

type Suggestion = SuggestState["suggestions"][number];

const CREATION_STEPS = [
  { title: "Saving your project", detail: "Name, brief, packs, and constraints are stored." },
  { title: "Scoring the catalog", detail: "Every category is scored deterministically against your constraints." },
  { title: "AI explains the first comparison", detail: "The reasoning model thinks silently, then writes the trade-off summary. This is the long part." },
  { title: "Opening your project", detail: "You land on the Comparison tab with the first run ready." },
] as const;

const CREATION_TIPS = [
  "While you wait: the scores you'll see are computed in code — the AI only explains them, it can't move a number.",
  "While you wait: after this, the BOM, research index, and validation tabs all start from this same brief.",
  "While you wait: picked the wrong packs? Constraints can be edited later in the project — nothing here is locked in.",
  "While you wait: a slow answer usually means a careful one — the model is checking your constraints against real parts.",
] as const;

/** Which creation step the wait has most likely reached, by elapsed time. */
export function creationStepForElapsed(elapsedSeconds: number): number {
  if (elapsedSeconds < 4) return 0;
  if (elapsedSeconds < 12) return 1;
  if (elapsedSeconds < 75) return 2;
  return 3;
}

/**
 * The wait screen shown while a project is created. Creation saves the
 * project, scores every catalog category, then waits on the AI explaining
 * the first comparison — easily 30-90s of silent reasoning. Instead of a
 * lone "Creating..." button, this gives the wait a shape: a step journey
 * (advanced by elapsed time, since a server action can't report back
 * mid-flight), the project being built to re-read, rotating notes on what
 * happens next, and a timer so the wait reads as measured, not hung.
 * Exported for tests.
 */
export function ProjectCreatingPanel({
  name,
  brief,
  packsCount,
  extrasCount,
}: {
  name: string;
  brief: string;
  packsCount: number;
  extrasCount: number;
}) {
  const elapsed = useElapsedSeconds();
  const activeStep = creationStepForElapsed(elapsed);
  const tip = CREATION_TIPS[Math.floor(elapsed / 6) % CREATION_TIPS.length];

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Sparkles className="size-5 text-primary motion-safe:animate-pulse" />
          <Loader2 className="absolute -right-1 -bottom-1 size-4 rounded-full bg-background text-primary motion-safe:animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Building “{name.trim() || "your project"}”…
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {packsCount} pack{packsCount === 1 ? "" : "s"} · {extrasCount}{" "}
            extra{extrasCount === 1 ? "" : "s"} — sit tight, this part does
            the heavy lifting for the whole project.
          </p>
        </div>
        <span className="numeric shrink-0 text-xs text-muted-foreground tabular-nums">
          {elapsed}s
        </span>
      </div>

      <div
        aria-hidden="true"
        className="h-1 overflow-hidden rounded-full bg-primary/15"
      >
        <div className="h-full w-2/5 animate-ai-progress rounded-full bg-primary/70" />
      </div>

      <ol className="space-y-2">
        {CREATION_STEPS.map((step, index) => {
          const done = index < activeStep;
          const active = index === activeStep;
          return (
            <li key={step.title} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-3" />
                ) : active ? (
                  <Loader2 className="size-3 motion-safe:animate-spin" />
                ) : (
                  <span className="size-1 rounded-full bg-current" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-xs",
                    active
                      ? "font-medium text-foreground"
                      : done
                        ? "text-foreground/70"
                        : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
                {active ? (
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {step.detail}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {brief.trim() ? (
        <p className="line-clamp-3 rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="numeric mr-1.5 text-[9px] uppercase tracking-[0.14em]">
            Your brief
          </span>
          {brief.trim()}
        </p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground italic">
        {tip}
      </p>
      {elapsed >= 45 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Still with you — reasoning models can take a minute or more on this
          step. No need to refresh; it will open the project on its own.
        </p>
      ) : null}
    </div>
  );
}

export function NewProjectButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [packs, setPacks] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<"ai" | "rules" | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [suggesting, startSuggesting] = useTransition();
  const [creating, startCreating] = useTransition();

  function togglePack(id: string) {
    setPacks((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Packs changed: previously suggested extras may no longer apply.
    setSuggestions([]);
    setChecked(new Set());
    setSource(null);
  }

  function suggest() {
    setSuggestError(null);
    startSuggesting(async () => {
      const result = await suggestConstraintsAction({
        brief,
        packIds: [...packs],
      });
      if (result.error) {
        setSuggestError(result.error);
        return;
      }
      setSuggestions(result.suggestions);
      setSource(result.source);
      setChecked(new Set(result.suggestions.map((_, index) => index)));
    });
  }

  function toggleSuggestion(index: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function create() {
    setCreateError(null);
    const extras = suggestions
      .filter((_, index) => checked.has(index))
      .map((suggestion) => ({
        label: suggestion.label,
        metric: suggestion.metric,
        operator: suggestion.operator,
        value: suggestion.value,
        unit: suggestion.unit,
        kind: suggestion.kind as "mandatory" | "preference",
        appliesTo: suggestion.appliesTo,
      }));

    startCreating(async () => {
      const result = await createProjectWithPacksAction({
        name,
        brief,
        packIds: [...packs],
        extras,
      });
      // A successful creation redirects; only errors return here.
      if (result?.error) {
        setCreateError(result.error);
      }
    });
  }

  const nameOk = name.trim().length >= 2;
  const briefLen = brief.trim().length;
  const briefOk = briefLen >= 20;
  const canSuggest = briefLen >= 10 && !suggesting;
  const canCreate = nameOk && briefOk && !creating;
  const blockers = [
    !nameOk ? "a name (2+ characters)" : null,
    !briefOk ? `a longer brief (${Math.max(0, 20 - briefLen)} more characters)` : null,
  ].filter(Boolean);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Keep the wait screen in front of the user while creation runs.
        if (!creating) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Plus data-icon="inline-start" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <p className="numeric text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            M3 · constraint packs
          </p>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Pick the universal packs that describe this build — rails, buses,
            wireless, power behavior, board role. The AI suggests likely extras;
            you confirm each one before anything is stored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="new-project-name"
              className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Name
            </label>
            <input
              id="new-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Greenhouse water monitor"
              maxLength={80}
              autoComplete="off"
              aria-invalid={!nameOk}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            {!nameOk && name.length > 0 ? (
              <p className="text-[11px] text-destructive">
                Name needs at least 2 characters.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="new-project-brief"
                className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                Brief (20 characters minimum)
              </label>
              <span
                className={`numeric text-[10px] ${briefOk ? "text-muted-foreground" : "text-destructive"}`}
                aria-live="polite"
              >
                {briefLen}/20 characters
              </span>
            </div>
            <textarea
              id="new-project-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Battery-powered tank monitor, outdoor, reports over Wi-Fi every 15 minutes..."
              rows={3}
              maxLength={2000}
              aria-invalid={!briefOk && brief.length > 0}
              className="min-h-20 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            {!briefOk && brief.length > 0 ? (
              <p className="text-[11px] text-destructive">
                {20 - briefLen} more character{20 - briefLen === 1 ? "" : "s"}{" "}
                needed — the brief seeds requirements and suggestions.
              </p>
            ) : null}
          </div>

          {PACK_DIMENSIONS.map((dimension) => (
            <fieldset key={dimension.key}>
              <legend className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {dimension.label} —{" "}
                <span className="normal-case tracking-normal">
                  {dimension.description}
                </span>
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {dimension.options.map((option) => {
                  const selected = packs.has(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => togglePack(option.id)}
                      title={`${option.hint} — adds ${option.constraints.length} constraint${option.constraints.length === 1 ? "" : "s"}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                        selected
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="rounded-lg border border-dashed border-border bg-card/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">
                  AI-suggested extras
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Predicted from your packs and brief. Nothing is stored until
                  you tick it and create the project.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={suggest}
                disabled={!canSuggest}
              >
                <Sparkles data-icon="inline-start" />
                {suggesting
                  ? "Predicting..."
                  : suggestions.length > 0
                    ? "Re-suggest"
                    : "Suggest extras"}
              </Button>
            </div>

            {suggesting ? (
              <AiProgress label="Predicting extra constraints" className="mt-3" />
            ) : null}

            {suggestError ? (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {suggestError}
              </p>
            ) : null}

            {source ? (
              <p className="numeric mt-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {source === "ai" ? "AI suggestions" : "Rule-based suggestions"} —{" "}
                {checked.size}/{suggestions.length} selected
              </p>
            ) : null}

            {suggestions.length > 0 ? (
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {suggestions.map((suggestion, index) => {
                  const on = checked.has(index);
                  return (
                    <li key={`${suggestion.metric}-${suggestion.operator}-${index}`}>
                      <label className="flex cursor-pointer items-start gap-2.5 py-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleSuggestion(index)}
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-foreground">
                            {suggestion.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                            {suggestion.reason}
                          </span>
                          <span className="numeric mt-0.5 block text-[10px] text-muted-foreground">
                            {suggestion.kind} · {suggestion.metric}{" "}
                            {suggestion.operator} ·{" "}
                            {suggestion.appliesTo.length === 0
                              ? "all categories"
                              : suggestion.appliesTo.join(", ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {createError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {createError}
            </p>
          ) : null}
        </div>

        {creating ? (
          <ProjectCreatingPanel
            name={name}
            brief={brief}
            packsCount={packs.size}
            extrasCount={checked.size}
          />
        ) : null}

        <DialogFooter>
          <p className="mr-auto text-[11px] leading-relaxed text-muted-foreground">
            {packs.size} pack{packs.size === 1 ? "" : "s"} ·{" "}
            {checked.size} extra{checked.size === 1 ? "" : "s"} — the first
            comparison auto-runs in the best-scoring category.
            {blockers.length > 0 && !creating ? (
              <>
                <br />
                Needs {blockers.join(" and ")} to create.
              </>
            ) : null}
          </p>
          <Button
            type="button"
            onClick={create}
            disabled={!canCreate}
            title={
              blockers.length > 0
                ? `Needs ${blockers.join(" and ")}`
                : "Create project"
            }
          >
            {creating ? "Creating..." : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
