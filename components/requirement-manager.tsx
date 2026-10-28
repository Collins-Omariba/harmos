"use client";

import {
  createRequirementAction,
  deleteRequirementAction,
  updateRequirementAction,
} from "@/app/actions/records";
import { RequirementCard } from "@/components/requirement-card";
import {
  AddButton,
  DeleteButton,
  EditButton,
  Field,
  HiddenFields,
  NativeSelect,
  RecordDialog,
  TextArea,
} from "@/components/record-dialog";

type Requirement = {
  id: string;
  text: string;
  kind: string;
  status: string;
};

const KINDS = ["mandatory", "preference", "unknown"];
const STATUSES = ["confirmed", "assumed", "needs_clarification"];

function RequirementFields({ requirement }: { requirement?: Requirement }) {
  const id = requirement ? `req-${requirement.id}` : "req-new";
  return (
    <>
      <Field label="Requirement" htmlFor={`${id}-text`}>
        <TextArea
          id={`${id}-text`}
          name="text"
          required
          rows={3}
          defaultValue={requirement?.text ?? ""}
          placeholder="The system must..."
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind" htmlFor={`${id}-kind`}>
          <NativeSelect
            id={`${id}-kind`}
            name="kind"
            defaultValue={requirement?.kind ?? "mandatory"}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <NativeSelect
            id={`${id}-status`}
            name="status"
            defaultValue={requirement?.status ?? "needs_clarification"}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </>
  );
}

export function RequirementManager({
  projectId,
  requirements,
}: {
  projectId: string;
  requirements: Requirement[];
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RecordDialog
          title="Add requirement"
          description="Hard constraints are scored in code; preferences guide trade-offs."
          action={createRequirementAction}
          submitLabel="Add requirement"
          trigger={<AddButton label="Add requirement" />}
        >
          <HiddenFields fields={{ projectId }} />
          <RequirementFields />
        </RecordDialog>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {requirements.map((requirement, index) => (
          <div key={requirement.id}>
            <RequirementCard requirement={requirement} index={index} />
            <div className="mt-1 flex items-center justify-end gap-0.5">
              <RecordDialog
                title="Edit requirement"
                description="Changes apply to future comparison runs."
                action={updateRequirementAction}
                submitLabel="Save changes"
                trigger={<EditButton />}
              >
                <HiddenFields
                  fields={{ projectId, recordId: requirement.id }}
                />
                <RequirementFields requirement={requirement} />
              </RecordDialog>
              <DeleteButton
                action={deleteRequirementAction}
                fields={{ projectId, recordId: requirement.id }}
                label="Delete requirement"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
