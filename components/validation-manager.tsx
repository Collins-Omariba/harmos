"use client";

import {
  createValidationTestAction,
  deleteValidationTestAction,
  updateValidationTestAction,
} from "@/app/actions/records";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

type ValidationTest = {
  id: string;
  name: string;
  status: string;
  notes: string;
};

const STATUSES = ["pending", "pass", "fail", "blocked"];

function ValidationTestFields({ test }: { test?: ValidationTest }) {
  const id = test ? `vtest-${test.id}` : "vtest-new";
  return (
    <>
      <Field label="Test name" htmlFor={`${id}-name`}>
        <TextInput
          id={`${id}-name`}
          name="name"
          required
          defaultValue={test?.name ?? ""}
          placeholder="Accelerated 90-day sleep-current run"
        />
      </Field>
      <Field label="Status" htmlFor={`${id}-status`}>
        <NativeSelect
          id={`${id}-status`}
          name="status"
          defaultValue={test?.status ?? "pending"}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Notes" htmlFor={`${id}-notes`}>
        <TextArea
          id={`${id}-notes`}
          name="notes"
          rows={3}
          defaultValue={test?.notes ?? ""}
          placeholder="Procedure, targets, measured results..."
        />
      </Field>
    </>
  );
}

export function ValidationManager({
  projectId,
  tests,
}: {
  projectId: string;
  tests: ValidationTest[];
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RecordDialog
          title="Add validation test"
          description="Track what was verified, and whether it passed."
          action={createValidationTestAction}
          submitLabel="Add test"
          trigger={<AddButton label="Add test" />}
        >
          <HiddenFields fields={{ projectId }} />
          <ValidationTestFields />
        </RecordDialog>
      </div>

      {tests.length > 0 ? (
        <div className="space-y-3">
          {tests.map((test) => (
            <div key={test.id} className="rounded-lg border border-border bg-card/70 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{test.name}</p>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className="border-accent/35 bg-accent/10 font-mono text-[10px] uppercase tracking-[0.12em] text-accent"
                  >
                    {test.status}
                  </Badge>
                  <RecordDialog
                    title="Edit validation test"
                    description="Update the procedure, status, or results."
                    action={updateValidationTestAction}
                    submitLabel="Save changes"
                    trigger={<EditButton />}
                  >
                    <HiddenFields fields={{ projectId, recordId: test.id }} />
                    <ValidationTestFields test={test} />
                  </RecordDialog>
                  <DeleteButton
                    action={deleteValidationTestAction}
                    fields={{ projectId, recordId: test.id }}
                    label="Delete validation test"
                  />
                </div>
              </div>
              {test.notes ? (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {test.notes}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No validation tests recorded yet.
        </p>
      )}
    </div>
  );
}

export function ValidationCardShell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="gap-0 border border-border bg-card/70 py-0 shadow-none ring-0">
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
