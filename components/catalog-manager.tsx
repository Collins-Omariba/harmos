"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import {
  createCatalogPartAction,
  deleteCatalogPartAction,
  updateCatalogPartAction,
} from "@/app/actions/catalog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATALOG_CATEGORIES, type CatalogPart } from "@/lib/catalog/types";
import { isSourceStale, sourceAgeLabel } from "@/lib/catalog/staleness";
import { cn } from "@/lib/utils";
import {
  AddButton,
  DeleteButton,
  EditButton,
  Field,
  HiddenFields,
  NativeSelect,
  RecordDialog,
  TextArea,
  TextInput,
} from "@/components/record-dialog";

function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

const ORIGIN_STYLES: Record<string, string> = {
  seeded: "border-border bg-muted/40 text-muted-foreground",
  imported: "border-accent/35 bg-accent/10 text-accent",
  custom: "border-primary/35 bg-primary/10 text-primary",
};

function PartFields({ part }: { part?: CatalogPart }) {
  const id = part ? `catalog-${part.id}` : "catalog-new";
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Part number" htmlFor={`${id}-part`}>
          <TextInput
            id={`${id}-part`}
            name="partNumber"
            required
            defaultValue={part?.partNumber ?? ""}
            placeholder="TPS7A02"
          />
        </Field>
        <Field label="Manufacturer" htmlFor={`${id}-mfr`}>
          <TextInput
            id={`${id}-mfr`}
            name="manufacturer"
            required
            defaultValue={part?.manufacturer ?? ""}
            placeholder="Texas Instruments"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" htmlFor={`${id}-cat`}>
          <NativeSelect
            id={`${id}-cat`}
            name="category"
            defaultValue={part?.category ?? "level-sensor"}
          >
            {CATALOG_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Package" htmlFor={`${id}-pkg`}>
          <TextInput
            id={`${id}-pkg`}
            name="package"
            required
            defaultValue={part?.package ?? ""}
            placeholder="SOT-23-5 / Module"
          />
        </Field>
      </div>
      <Field label="Description" htmlFor={`${id}-desc`}>
        <TextArea
          id={`${id}-desc`}
          name="description"
          required
          rows={2}
          defaultValue={part?.description ?? ""}
          placeholder="What the part is, in one or two sentences."
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Datasheet URL" htmlFor={`${id}-ds`}>
          <TextInput
            id={`${id}-ds`}
            name="datasheetUrl"
            type="url"
            required
            defaultValue={part?.datasheetUrl ?? ""}
            placeholder="https://…"
          />
        </Field>
        <Field label="Source URL" htmlFor={`${id}-src`}>
          <TextInput
            id={`${id}-src`}
            name="sourceUrl"
            type="url"
            required
            defaultValue={part?.sourceUrl ?? ""}
            placeholder="https://…"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Retrieved on" htmlFor={`${id}-date`}>
          <TextInput
            id={`${id}-date`}
            name="sourceRetrievedAt"
            type="date"
            required
            defaultValue={part ? toDateInput(part.sourceRetrievedAt) : todayInput()}
          />
        </Field>
        <Field label="Price USD (empty if unknown)" htmlFor={`${id}-price`}>
          <TextInput
            id={`${id}-price`}
            name="priceUsd"
            inputMode="decimal"
            placeholder="0.35"
            defaultValue={
              part?.priceUsd !== null && part?.priceUsd !== undefined
                ? String(part.priceUsd)
                : ""
            }
          />
        </Field>
        <Field label="Tags (comma separated)" htmlFor={`${id}-tags`}>
          <TextInput
            id={`${id}-tags`}
            name="tags"
            defaultValue={part?.tags.join(", ") ?? ""}
            placeholder="ldo, low-power"
          />
        </Field>
      </div>
      <Field label="Specs (JSON — keys must be known metrics)" htmlFor={`${id}-specs`}>
        <TextArea
          id={`${id}-specs`}
          name="specsJson"
          required
          rows={5}
          defaultValue={
            part
              ? JSON.stringify(
                  Object.fromEntries(
                    Object.entries(part.specs).filter(([key]) => key !== "priceUsd"),
                  ),
                  null,
                  2,
                )
              : '{\n  "supplyMinV": 3.0,\n  "supplyMaxV": 5.5,\n  "interfaces": ["i2c"]\n}'
          }
          placeholder='{"supplyMinV": 3.0, "interfaces": ["i2c"]}'
        />
      </Field>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Spec keys must match the scorer&apos;s metric list — unknown keys are
        rejected so a typo can never score as &ldquo;not specified&rdquo;.
      </p>
    </>
  );
}

export function CatalogManager({ parts }: { parts: CatalogPart[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return parts.filter((part) => {
      if (category !== "all" && part.category !== category) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [part.partNumber, part.manufacturer, part.description, ...part.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [parts, query, category]);

  const counts = useMemo(() => {
    return parts.reduce(
      (totals, part) => {
        totals[part.origin] = (totals[part.origin] ?? 0) + 1;
        return totals;
      },
      {} as Record<string, number>,
    );
  }, [parts]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search part, manufacturer, tag..."
          aria-label="Search catalog"
          className="h-9 min-w-52 flex-1 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="all">All categories</option>
          {CATALOG_CATEGORIES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {filtered.length}/{parts.length} parts
        </span>
        <span className="numeric hidden text-[10px] text-muted-foreground xl:inline">
          {counts.seeded ?? 0} seeded · {counts.imported ?? 0} imported ·{" "}
          {counts.custom ?? 0} custom
        </span>
        <div className="ml-auto">
          <RecordDialog
            title="Add catalog part"
            description="Custom rows are yours: the seed only fills gaps and never overwrites."
            action={createCatalogPartAction}
            submitLabel="Add part"
            trigger={<AddButton label="Add part" />}
          >
            <PartFields />
          </RecordDialog>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Part
              </TableHead>
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Price
              </TableHead>
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Origin
              </TableHead>
              <TableHead className="numeric hidden text-[10px] uppercase tracking-[0.16em] lg:table-cell">
                Source
              </TableHead>
              <TableHead className="numeric text-right text-[10px] uppercase tracking-[0.16em]">
                Edit
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((part) => (
              <TableRow key={part.id} className="border-border">
                <TableCell>
                  <p className="numeric text-sm font-medium text-foreground">
                    {part.partNumber}
                  </p>
                  <p className="mt-0.5 max-w-md truncate text-[11px] text-muted-foreground">
                    {part.manufacturer} · {part.package} · {part.description}
                  </p>
                </TableCell>
                <TableCell className="numeric text-muted-foreground">
                  {part.priceUsd !== null ? `$${part.priceUsd.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.12em]",
                      ORIGIN_STYLES[part.origin] ??
                        "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {part.origin}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <a
                    href={part.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {sourceAgeLabel(part.sourceRetrievedAt)}
                    <ExternalLink className="size-3" />
                  </a>
                  {isSourceStale(part.sourceRetrievedAt) ? (
                    <span className="numeric ml-2 rounded-sm border border-accent/35 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                      verify
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <RecordDialog
                      title="Edit catalog part"
                      description="Edits never change a row's origin; set a fresh retrieval date."
                      action={updateCatalogPartAction}
                      submitLabel="Save changes"
                      trigger={<EditButton />}
                    >
                      <HiddenFields fields={{ recordId: part.id }} />
                      <PartFields part={part} />
                    </RecordDialog>
                    <DeleteButton
                      action={deleteCatalogPartAction}
                      fields={{ recordId: part.id }}
                      label="Delete catalog part"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No parts match. Loosen the search — or add the part above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
