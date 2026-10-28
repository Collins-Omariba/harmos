"use client";

import {
  createDecisionAction,
  deleteDecisionAction,
  updateDecisionAction,
} from "@/app/actions/records";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
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

type Decision = {
  id: string;
  title: string;
  rationale: string;
  decidedAt: Date;
};

function toDateInput(value: Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function DecisionFields({ decision }: { decision?: Decision }) {
  const id = decision ? `decision-${decision.id}` : "decision-new";
  return (
    <>
      <Field label="Title" htmlFor={`${id}-title`}>
        <TextInput
          id={`${id}-title`}
          name="title"
          required
          defaultValue={decision?.title ?? ""}
          placeholder="Regulate with a 3.3 V LDO instead of a buck converter"
        />
      </Field>
      <Field label="Rationale" htmlFor={`${id}-rationale`}>
        <TextArea
          id={`${id}-rationale`}
          name="rationale"
          required
          rows={4}
          defaultValue={decision?.rationale ?? ""}
          placeholder="Why this option, what was traded off, what would reopen it..."
        />
      </Field>
      <Field label="Decided on" htmlFor={`${id}-date`}>
        <TextInput
          id={`${id}-date`}
          name="decidedAt"
          type="date"
          required
          defaultValue={decision ? toDateInput(decision.decidedAt) : toDateInput(new Date())}
        />
      </Field>
    </>
  );
}

export function DecisionManager({
  projectId,
  decisions,
}: {
  projectId: string;
  decisions: Decision[];
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RecordDialog
          title="Record decision"
          description="Design decisions and their rationale, dated."
          action={createDecisionAction}
          submitLabel="Record decision"
          trigger={<AddButton label="Record decision" />}
        >
          <HiddenFields fields={{ projectId }} />
          <DecisionFields />
        </RecordDialog>
      </div>

      {decisions.length > 0 ? (
        <div className="space-y-3">
          {decisions.map((decision) => (
            <Card
              key={decision.id}
              className="gap-0 rounded-l-none border border-l-2 border-border border-l-accent bg-card/70 py-0 shadow-none ring-0"
            >
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-sm font-medium text-foreground">
                    {decision.title}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="numeric mr-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {formatDate(decision.decidedAt)}
                    </span>
                    <RecordDialog
                      title="Edit decision"
                      description="Correct the record; the date stays explicit."
                      action={updateDecisionAction}
                      submitLabel="Save changes"
                      trigger={<EditButton />}
                    >
                      <HiddenFields fields={{ projectId, recordId: decision.id }} />
                      <DecisionFields decision={decision} />
                    </RecordDialog>
                    <DeleteButton
                      action={deleteDecisionAction}
                      fields={{ projectId, recordId: decision.id }}
                      label="Delete decision"
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {decision.rationale}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No decisions recorded yet.
        </p>
      )}
    </div>
  );
}
