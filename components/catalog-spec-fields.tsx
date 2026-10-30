"use client";

import { Info } from "lucide-react";

import { Field, TextInput } from "@/components/record-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COMPARISON_METRICS, type MetricDef } from "@/lib/comparison/metrics";
import { isSpecFormField, specsForCategory } from "@/lib/catalog/specs";
import type { CatalogSpecs } from "@/lib/catalog/types";
import { catalogCategoryLabel } from "@/lib/catalog/types";

function defaultFor(metric: string, specs?: CatalogSpecs): string {
  if (!specs) return "";
  const value = specs[metric as keyof CatalogSpecs];
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function MetricLabel({ def }: { def: MetricDef }) {
  const unit = def.units[0];
  return (
    <span className="inline-flex items-center gap-1">
      <span>
        {def.label}
        {unit ? ` (${unit})` : ""}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${def.label}`}
            className="rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Info className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-60 leading-relaxed">
          {def.help}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function MetricInput({ def, specs, id }: {
  def: MetricDef;
  specs?: CatalogSpecs;
  id: string;
}) {
  const name = `spec_${def.metric}`;
  const inputId = `${id}-${def.metric}`;
  const isList = def.metric === "interfaces" || def.metric === "wireless";
  const unit = def.units[0];
  return (
    <Field label={<MetricLabel def={def} />} htmlFor={inputId}>
      <TextInput
        id={inputId}
        name={name}
        defaultValue={defaultFor(def.metric, specs)}
        inputMode={def.valueType === "number" ? "decimal" : undefined}
        placeholder={
          isList
            ? "comma separated"
            : def.valueType === "number"
              ? unit ?? "number"
              : "—"
        }
        autoComplete="off"
      />
    </Field>
  );
}

function Section({ title, metrics, specs, id }: {
  title: string;
  metrics: MetricDef[];
  specs?: CatalogSpecs;
  id: string;
}) {
  if (metrics.length === 0) return null;
  return (
    <fieldset className="rounded-md border border-border bg-muted/20 p-3">
      <legend className="numeric px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((def) => (
          <MetricInput key={def.metric} def={def} specs={specs} id={id} />
        ))}
      </div>
    </fieldset>
  );
}

const POWER = new Set([
  "supplyMinV",
  "supplyMaxV",
  "outputVoltageV",
  "outputCurrentMaxA",
  "currentTypA",
  "currentMaxA",
  "quiescentCurrentA",
  "sleepCurrentA",
]);

const SENSING = new Set([
  "rangeM",
  "minRangeM",
  "resolutionMm",
  "accuracyMm",
  "operatingTempMinC",
  "operatingTempMaxC",
  "ipRating",
]);

const COMPUTE = new Set([
  "batteryCapacityMah",
  "batteryNominalV",
  "adcBits",
  "channels",
  "sampleRateSps",
  "flashKb",
  "ramKb",
  "cpu",
]);


function group(metrics: MetricDef[]) {
  return {
    power: metrics.filter((def) => POWER.has(def.metric)),
    sensing: metrics.filter((def) => SENSING.has(def.metric)),
    compute: metrics.filter((def) => COMPUTE.has(def.metric)),
    connectivity: metrics.filter(
      (def) =>
        !POWER.has(def.metric) &&
        !SENSING.has(def.metric) &&
        !COMPUTE.has(def.metric),
    ),
  };
}

/**
 * Category-aware spec entry: only the metrics a part of this category can
 * score on are shown, each with an info icon explaining where the value
 * comes from. Remaining metrics hide under “All fields” so stored values
 * are never lost when editing. Empty inputs are omitted from the specs.
 */
export function SpecFields({
  specs,
  id,
  category,
}: {
  specs?: CatalogSpecs;
  id: string;
  category: string;
}) {
  const wanted = new Set(specsForCategory(category));
  const primary = COMPARISON_METRICS.filter(
    (def) => isSpecFormField(def.metric) && wanted.has(def.metric),
  );
  const rest = COMPARISON_METRICS.filter(
    (def) => isSpecFormField(def.metric) && !wanted.has(def.metric),
  );
  const sections = group(primary);

  // Prefilled values outside the category list (e.g. from an import) force
  // the overflow open so saving can never silently drop them.
  const hasOverflowValues =
    specs !== undefined &&
    rest.some((def) => {
      const value = specs[def.metric as keyof CatalogSpecs];
      return value !== undefined && value !== null &&
        (!Array.isArray(value) || value.length > 0);
    });

  return (
    <div className="space-y-3">
      <p className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Showing {primary.length} fields for {catalogCategoryLabel(category)}
      </p>
      <Section title="Power" metrics={sections.power} specs={specs} id={id} />
      <Section
        title="Sensing & environment"
        metrics={sections.sensing}
        specs={specs}
        id={id}
      />
      <Section
        title="Compute & storage"
        metrics={sections.compute}
        specs={specs}
        id={id}
      />
      <Section
        title="Connectivity"
        metrics={sections.connectivity}
        specs={specs}
        id={id}
      />
      <details
        open={hasOverflowValues || undefined}
        className="rounded-md border border-dashed border-border px-3 py-2"
      >
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          All fields ({rest.length} more)
        </summary>
        <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-3">
          {rest.map((def) => (
            <MetricInput key={def.metric} def={def} specs={specs} id={`all-${id}`} />
          ))}
        </div>
      </details>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Leave a field empty when the datasheet does not state it — empty
        fields are left out, never scored. Supply range is entered as min/max;
        the scorer checks coverage from those two.
      </p>
    </div>
  );
}
