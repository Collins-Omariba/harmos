"use client";

import { useState } from "react";

import {
  createConstraintAction,
  deleteConstraintAction,
  updateConstraintAction,
} from "@/app/actions/records";
import { Badge } from "@/components/ui/badge";
import { COMPARISON_OPERATORS, COMPARISON_METRICS, getMetricDef } from "@/lib/comparison/metrics";
import { formatExpected } from "@/lib/comparison/scorer";
import type { ComparisonConstraint } from "@/lib/comparison/types";
import {
  AddButton,
  DeleteButton,
  EditButton,
  Field,
  HiddenFields,
  NativeSelect,
  RecordDialog,
  TextInput,
} from "@/components/record-dialog";

function ConstraintFields({ constraint }: { constraint?: ComparisonConstraint }) {
  const id = constraint ? `constraint-${constraint.id}` : "constraint-new";
  const [metric, setMetric] = useState(constraint?.metric ?? "supplyVoltageV");
  const def = getMetricDef(metric);
  const operators = COMPARISON_OPERATORS.filter(
    (op) => op.forType === "both" || op.forType === (def?.valueType ?? "number"),
  );

  return (
    <>
      <Field label="Label" htmlFor={`${id}-label`}>
        <TextInput
          id={`${id}-label`}
          name="label"
          required
          defaultValue={constraint?.label ?? ""}
          placeholder="Runs from the 3.3 V rail"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Metric" htmlFor={`${id}-metric`}>
          <select
            id={`${id}-metric`}
            name="metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {COMPARISON_METRICS.map((option) => (
              <option key={option.metric} value={option.metric}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Operator" htmlFor={`${id}-operator`}>
          <NativeSelect
            id={`${id}-operator`}
            name="operator"
            defaultValue={String(constraint?.operator ?? "gte")}
            key={metric}
          >
            {operators.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label={def?.valueType === "string" ? "Value (text)" : "Value"} htmlFor={`${id}-value`}>
          <TextInput
            id={`${id}-value`}
            name="value"
            required
            inputMode={def?.valueType === "string" ? "text" : "decimal"}
            defaultValue={
              constraint ? String(constraint.value) : def?.valueType === "string" ? "i2c" : ""
            }
            placeholder={def?.valueType === "string" ? "i2c" : "3.3"}
          />
        </Field>
        <Field label="Unit (optional)" htmlFor={`${id}-unit`}>
          <TextInput
            id={`${id}-unit`}
            name="unit"
            maxLength={12}
            defaultValue={constraint?.unit ?? def?.units[0] ?? ""}
            placeholder={def?.units[0] ?? "V"}
          />
        </Field>
        <Field label="Kind" htmlFor={`${id}-kind`}>
          <NativeSelect
            id={`${id}-kind`}
            name="kind"
            defaultValue={constraint?.kind ?? "mandatory"}
          >
            <option value="mandatory">mandatory</option>
            <option value="preference">preference</option>
          </NativeSelect>
        </Field>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Mandatory constraints fail a candidate outright; preferences only mark
        it for review. Editing constraints does not rewrite past runs — re-run
        the comparison to apply them.
      </p>
    </>
  );
}

export function ConstraintManager({
  projectId,
  constraints,
}: {
  projectId: string;
  constraints: ComparisonConstraint[];
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RecordDialog
          title="Add constraint"
          description="Hard constraints are scored in code against catalog specs."
          action={createConstraintAction}
          submitLabel="Add constraint"
          trigger={<AddButton label="Add constraint" />}
        >
          <HiddenFields fields={{ projectId }} />
          <ConstraintFields />
        </RecordDialog>
      </div>

      {constraints.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {constraints.map((constraint) => (
            <li
              key={constraint.id}
              className="flex items-start justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs leading-snug text-foreground/90">
                  {constraint.label}
                </p>
                <p className="numeric mt-0.5 text-[10px] text-muted-foreground">
                  {constraint.metric}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="mr-1 text-right">
                  <Badge
                    variant="outline"
                    className={
                      constraint.kind === "mandatory"
                        ? "border-primary/35 bg-primary/10 font-mono text-[9px] uppercase tracking-[0.1em] text-primary"
                        : "border-accent/35 bg-accent/10 font-mono text-[9px] uppercase tracking-[0.1em] text-accent"
                    }
                  >
                    {constraint.kind}
                  </Badge>
                  <p className="numeric mt-1 text-[10px] text-muted-foreground">
                    {formatExpected(
                      constraint.operator,
                      constraint.value,
                      constraint.unit,
                    )}
                  </p>
                </div>
                <RecordDialog
                  title="Edit constraint"
                  description="Past comparison runs keep their snapshot; re-run to apply."
                  action={updateConstraintAction}
                  submitLabel="Save changes"
                  trigger={<EditButton />}
                >
                  <HiddenFields fields={{ projectId, recordId: constraint.id }} />
                  <ConstraintFields constraint={constraint} />
                </RecordDialog>
                <DeleteButton
                  action={deleteConstraintAction}
                  fields={{ projectId, recordId: constraint.id }}
                  label="Delete constraint"
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          No comparison constraints are stored for this project yet.
        </p>
      )}
    </div>
  );
}
