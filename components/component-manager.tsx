"use client";

import { ExternalLink } from "lucide-react";

import {
  createComponentAction,
  deleteComponentAction,
  updateComponentAction,
} from "@/app/actions/records";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeBomTotals, formatCents } from "@/lib/bom/totals";
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

export function ComponentManager({
  projectId,
  components,
}: {
  projectId: string;
  components: ComponentRow[];
}) {
  const totals = computeBomTotals(components);

  return (
    <div>
      <div className="mb-3 flex justify-end">
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
