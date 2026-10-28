"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, ListChecks } from "lucide-react";

import { runComparisonAction } from "@/app/actions/comparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CatalogPart } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

type CategoryOption = {
  key: string;
  label: string;
  description: string;
};

type ComparisonRunnerProps = {
  projectId: string;
  categories: CategoryOption[];
  parts: CatalogPart[];
  defaultCategory: string;
  defaultPartIds: string[];
};

const MAX_SELECTED = 8;

function supplyRange(part: CatalogPart): string | null {
  const { supplyMinV, supplyMaxV } = part.specs;
  if (supplyMinV === undefined || supplyMaxV === undefined) {
    return null;
  }
  return `${supplyMinV}–${supplyMaxV} V`;
}

function partFacts(part: CatalogPart): string[] {
  const facts: string[] = [];
  const supply = supplyRange(part);

  if (supply) {
    facts.push(supply);
  }
  if (part.specs.rangeM !== undefined) {
    facts.push(`${part.specs.rangeM} m range`);
  }
  if (part.specs.outputCurrentMaxA !== undefined) {
    facts.push(`${part.specs.outputCurrentMaxA * 1000} mA out`);
  }
  if (part.specs.batteryCapacityMah !== undefined) {
    facts.push(`${part.specs.batteryCapacityMah} mAh`);
  }
  if (part.specs.interfaces?.length) {
    facts.push(part.specs.interfaces.slice(0, 3).join("/"));
  }
  if (part.priceUsd !== null) {
    facts.push(`$${part.priceUsd.toFixed(2)}`);
  }

  return facts;
}

function initialSelection(parts: CatalogPart[], ids: string[]): string[] {
  const valid = ids.filter((id) => parts.some((part) => part.id === id));
  return (valid.length > 0 ? valid : parts.slice(0, 5).map((part) => part.id))
    .slice(0, MAX_SELECTED);
}

export function ComparisonRunner({
  projectId,
  categories,
  parts,
  defaultCategory,
  defaultPartIds,
}: ComparisonRunnerProps) {
  const boundAction = runComparisonAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(boundAction, null);
  const [category, setCategory] = useState(defaultCategory);
  const [selected, setSelected] = useState(() =>
    initialSelection(
      parts.filter((part) => part.category === defaultCategory),
      defaultPartIds,
    ),
  );

  const categoryParts = useMemo(
    () =>
      parts
        .filter((part) => part.category === category)
        .sort((a, b) => a.partNumber.localeCompare(b.partNumber)),
    [parts, category],
  );

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory);
    setSelected(
      initialSelection(
        parts.filter((part) => part.category === nextCategory),
        [],
      ),
    );
  }

  function togglePart(id: string) {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (current.length >= MAX_SELECTED) {
        return current;
      }
      return [...current, id];
    });
  }

  return (
    <form action={formAction} className="rounded-lg border border-border bg-card/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Run comparison
          </p>
          <h3 className="mt-1.5 text-base font-medium text-foreground">
            Pick a category and candidates
          </h3>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Scoring runs in code against the project constraints. The AI only
            explains the trade-offs it is given; it never changes a pass/fail
            result.
          </p>
        </div>
        <Badge
          variant="outline"
          className="numeric border-border bg-muted/40 text-[10px] text-muted-foreground"
        >
          {selected.length}/{MAX_SELECTED} selected
        </Badge>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[15rem_1fr]">
        <div className="space-y-4">
          <label className="block">
            <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Catalog category
            </span>
            <select
              name="category"
              value={category}
              onChange={(event) => changeCategory(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {categories.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {categories.find((option) => option.key === category)?.description}
          </p>
          <p className="numeric text-[10px] text-muted-foreground">
            {categoryParts.length} parts in this category
          </p>
        </div>

        <div className="min-w-0">
          <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {categoryParts.map((part) => {
              const checked = selected.includes(part.id);
              const disabled = !checked && selected.length >= MAX_SELECTED;
              const facts = partFacts(part);

              return (
                <label
                  key={part.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input",
                      checked && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {checked ? <Check className="size-3" /> : null}
                  </span>
                  <input
                    type="checkbox"
                    name="catalogPartIds"
                    value={part.id}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => togglePart(part.id)}
                    className="sr-only"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="numeric text-xs font-medium text-foreground">
                        {part.partNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {part.manufacturer}
                      </span>
                      <span className="numeric text-[10px] text-muted-foreground">
                        {part.package}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                      {facts.join(" · ")}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || selected.length === 0}>
              <ListChecks data-icon="inline-start" />
              {pending ? "Scoring..." : "Run deterministic comparison"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Up to {MAX_SELECTED} candidates per run.
            </span>
          </div>

          {state ? (
            <p
              className={cn(
                "mt-3 text-xs leading-relaxed",
                state.ok ? "text-primary" : "text-destructive",
              )}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
