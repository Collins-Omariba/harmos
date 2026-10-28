"use client";

import {
  createArtifactAction,
  deleteArtifactAction,
  updateArtifactAction,
} from "@/app/actions/records";
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

type Artifact = {
  id: string;
  kind: string;
  name: string;
  version: string;
  hash: string;
  metaJson: string;
};

const KINDS = [
  "schematic",
  "pcb",
  "firmware",
  "datasheet",
  "bom",
  "test",
  "decision",
  "doc",
];

function ArtifactFields({ artifact }: { artifact?: Artifact }) {
  const id = artifact ? `artifact-${artifact.id}` : "artifact-new";
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind" htmlFor={`${id}-kind`}>
          <NativeSelect
            id={`${id}-kind`}
            name="kind"
            defaultValue={artifact?.kind ?? "schematic"}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Name" htmlFor={`${id}-name`}>
          <TextInput
            id={`${id}-name`}
            name="name"
            required
            defaultValue={artifact?.name ?? ""}
            placeholder="Tank Monitor Main Board"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Version" htmlFor={`${id}-version`}>
          <TextInput
            id={`${id}-version`}
            name="version"
            required
            defaultValue={artifact?.version ?? ""}
            placeholder="rev A / v0.3.0"
          />
        </Field>
        <Field label="Hash" htmlFor={`${id}-hash`}>
          <TextInput
            id={`${id}-hash`}
            name="hash"
            required
            defaultValue={artifact?.hash ?? ""}
            placeholder="sha256:…"
          />
        </Field>
      </div>
      <Field label="Metadata (JSON)" htmlFor={`${id}-meta`}>
        <TextArea
          id={`${id}-meta`}
          name="metaJson"
          required
          rows={3}
          defaultValue={artifact?.metaJson ?? "{}"}
          placeholder='{"tool": "KiCad 9"}'
        />
      </Field>
    </>
  );
}

export function ArtifactManager({
  projectId,
  artifacts,
}: {
  projectId: string;
  artifacts: Artifact[];
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RecordDialog
          title="Add artifact"
          description="Versioned files: schematics, firmware, datasheets, BOMs."
          action={createArtifactAction}
          submitLabel="Add artifact"
          trigger={<AddButton label="Add artifact" />}
        >
          <HiddenFields fields={{ projectId }} />
          <ArtifactFields />
        </RecordDialog>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {artifacts.length > 0 ? (
          artifacts.map((artifact) => (
            <div key={artifact.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {artifact.name}
                  </p>
                  <p className="numeric mt-0.5 text-[11px] text-muted-foreground">
                    {artifact.kind} · {artifact.version} · {artifact.hash}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <RecordDialog
                    title="Edit artifact"
                    description="Bump the version and hash when the file changes."
                    action={updateArtifactAction}
                    submitLabel="Save changes"
                    trigger={<EditButton />}
                  >
                    <HiddenFields fields={{ projectId, recordId: artifact.id }} />
                    <ArtifactFields artifact={artifact} />
                  </RecordDialog>
                  <DeleteButton
                    action={deleteArtifactAction}
                    fields={{ projectId, recordId: artifact.id }}
                    label="Delete artifact"
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No artifacts recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
