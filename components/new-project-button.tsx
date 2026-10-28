"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Sparkles } from "lucide-react";

import {
  createProjectWithPacksAction,
  suggestConstraintsAction,
  type SuggestState,
} from "@/app/actions/projects";
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
    <Dialog open={open} onOpenChange={setOpen}>
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
