"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import {
  addCatalogComponentsAction,
  createComponentAction,
  deleteComponentAction,
  updateComponentAction,
} from "@/app/actions/records";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeBomTotals, formatCents } from "@/lib/bom/totals";
import { CATALOG_CATEGORIES, type CatalogPart } from "@/lib/catalog/types";
import {
  AddButton,
  DeleteButton,
  EditButton,
  Field,
  HiddenFields,
  RecordDialog,
  TextArea,
  TextInput,
} from "@/components/record-dialog";

export type ComponentRow = {
  id: string;
  partNumber: string;
  manufacturer: string;
  package: string;
  datasheetUrl: string | null;
  notes: string | null;
  quantity: number;
  unitPriceCents: number | null;
};

function ComponentFields({ component }: { component?: ComponentRow }) {
  const id = component ? `comp-${component.id}` : "comp-new";
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Part number" htmlFor={`${id}-part`}>
          <TextInput
            id={`${id}-part`}
            name="partNumber"
            required
            defaultValue={component?.partNumber ?? ""}
            placeholder="TPS7A02"
          />
        </Field>
        <Field label="Manufacturer" htmlFor={`${id}-mfr`}>
          <TextInput
            id={`${id}-mfr`}
            name="manufacturer"
            required
            defaultValue={component?.manufacturer ?? ""}
            placeholder="Texas Instruments"
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Package" htmlFor={`${id}-pkg`}>
          <TextInput
            id={`${id}-pkg`}
            name="package"
            required
            defaultValue={component?.package ?? ""}
            placeholder="SOT-23-5"
          />
        </Field>
        <Field label="Quantity" htmlFor={`${id}-qty`}>
          <TextInput
            id={`${id}-qty`}
            name="quantity"
            required
            type="number"
            min={0}
            step={1}
            defaultValue={component?.quantity ?? 1}
          />
        </Field>
        <Field label="Unit price USD (empty if unknown)" htmlFor={`${id}-price`}>
          <TextInput
            id={`${id}-price`}
            name="unitPrice"
            inputMode="decimal"
            placeholder="0.35"
            defaultValue={
              component?.unitPriceCents !== null &&
              component?.unitPriceCents !== undefined
                ? (component.unitPriceCents / 100).toFixed(2)
                : ""
            }
          />
        </Field>
      </div>
      <Field label="Datasheet URL (optional)" htmlFor={`${id}-ds`}>
        <TextInput
          id={`${id}-ds`}
          name="datasheetUrl"
          type="url"
          defaultValue={component?.datasheetUrl ?? ""}
          placeholder="https://…"
        />
      </Field>
      <Field label="Notes (optional)" htmlFor={`${id}-notes`}>
        <TextArea
          id={`${id}-notes`}
          name="notes"
          rows={2}
          defaultValue={component?.notes ?? ""}
        />
      </Field>
    </>
  );
}

function AddFromCatalog({
  projectId,
  parts,
}: {
  projectId: string;
  parts: CatalogPart[];
}) {
  const [category, setCategory] = useState<string>(
    CATALOG_CATEGORIES[0]?.key ?? "",
  );
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return parts.filter((part) => {
      if (category !== "all" && part.category !== category) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [part.partNumber, part.manufacturer, part.description]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [parts, category, query]);

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <RecordDialog
      title="Add from catalog"
      description="Real parts with sourced specs. Prices come along as a starting point — adjust them in the BOM."
      action={addCatalogComponentsAction}
      submitLabel={`Add ${checked.size} part${checked.size === 1 ? "" : "s"} to BOM`}
      trigger={
        <Button variant="outline" size="sm">
          Catalog
        </Button>
      }
    >
      <HiddenFields fields={{ projectId }} />
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <Field label="Category" htmlFor="bom-import-category">
          <select
            id="bom-import-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setChecked(new Set());
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="all">All categories</option>
            {CATALOG_CATEGORIES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search" htmlFor="bom-import-search">
          <TextInput
            id="bom-import-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Part, manufacturer, description…"
          />
        </Field>
      </div>
      <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {visible.map((part) => {
          const on = checked.has(part.id);
          return (
            <label
              key={part.id}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/40"
            >
              <input
                type="checkbox"
                name="catalogPartIds"
                value={part.id}
                checked={on}
                onChange={() => toggle(part.id)}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="numeric block text-xs font-medium text-foreground">
                  {part.partNumber}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {part.manufacturer} · {part.package}
                  </span>
                </span>
                <span className="numeric block text-[10px] text-muted-foreground">
                  {part.priceUsd !== null ? `$${part.priceUsd.toFixed(2)}` : "price unknown"} · {part.description.slice(0, 80)}
                </span>
              </span>
              {on ? (
                <input
                  type="number"
                  name={`qty_${part.id}`}
                  defaultValue={1}
                  min={0}
                  step={1}
                  aria-label={`Quantity for ${part.partNumber}`}
                  onClick={(event) => event.stopPropagation()}
                  className="h-7 w-16 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              ) : null}
            </label>
          );
        })}
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No catalog parts match.
          </p>
        ) : null}
      </div>
    </RecordDialog>
  );
}

export function ComponentManager({
  projectId,
  components,
  catalogParts,
}: {
  projectId: string;
  components: ComponentRow[];
  catalogParts: CatalogPart[];
}) {
  const totals = computeBomTotals(components);

  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        <AddFromCatalog projectId={projectId} parts={catalogParts} />
        <RecordDialog
          title="Add component"
          description="Selected parts land here and in the BOM below."
          action={createComponentAction}
          submitLabel="Add component"
          trigger={<AddButton label="Add component" />}
        >
          <HiddenFields fields={{ projectId }} />
          <ComponentFields />
        </RecordDialog>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Part
              </TableHead>
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Manufacturer
              </TableHead>
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Qty
              </TableHead>
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Unit
              </TableHead>
              <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
                Line
              </TableHead>
              <TableHead className="numeric hidden text-[10px] uppercase tracking-[0.16em] lg:table-cell">
                Datasheet
              </TableHead>
              <TableHead className="numeric text-right text-[10px] uppercase tracking-[0.16em]">
                Edit
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((component) => {
              const line = totals.lines.find((l) => l.id === component.id);
              return (
                <TableRow key={component.id} className="border-border">
                  <TableCell className="numeric font-medium text-foreground">
                    {component.partNumber}
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                      {component.package}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {component.manufacturer}
                  </TableCell>
                  <TableCell className="numeric text-foreground">
                    {component.quantity}×
                  </TableCell>
                  <TableCell className="numeric text-muted-foreground">
                    {component.unitPriceCents !== null
                      ? formatCents(component.unitPriceCents)
                      : "—"}
                  </TableCell>
                  <TableCell className="numeric text-foreground">
                    {line?.lineCents !== null && line?.lineCents !== undefined
                      ? formatCents(line.lineCents)
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {component.datasheetUrl ? (
                      <a
                        href={component.datasheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                      >
                        PDF
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <RecordDialog
                        title="Edit component"
                        description="Quantity and price feed the BOM totals."
                        action={updateComponentAction}
                        submitLabel="Save changes"
                        trigger={<EditButton />}
                      >
                        <HiddenFields
                          fields={{ projectId, recordId: component.id }}
                        />
                        <ComponentFields component={component} />
                      </RecordDialog>
                      <DeleteButton
                        action={deleteComponentAction}
                        fields={{ projectId, recordId: component.id }}
                        label="Delete component"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card/70 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Bill of materials
            </p>
            <p className="mt-1 text-sm text-foreground">
              {totals.pricedLines} of {components.length} lines priced
              {totals.unpricedLines > 0
                ? ` · ${totals.unpricedLines} unpriced (excluded)`
                : ""}
              {" · "}
              {totals.totalUnits} units
            </p>
          </div>
          <p className="numeric text-2xl leading-none text-foreground">
            {formatCents(totals.totalCents)}
          </p>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Totals are integer-cent arithmetic in code. Unpriced lines are listed
          but excluded from the total until a unit price is entered.
        </p>
        {components.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {components.map((component) => (
              <Badge
                key={component.id}
                variant="outline"
                className="numeric border-border bg-muted/40 text-[10px] text-muted-foreground"
              >
                {component.partNumber} ×{component.quantity}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
