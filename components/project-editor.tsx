"use client";

import { updateProjectAction } from "@/app/actions/records";
import { Button } from "@/components/ui/button";
import {
  Field,
  HiddenFields,
  NativeSelect,
  RecordDialog,
  TextArea,
  TextInput,
} from "@/components/record-dialog";

export function ProjectEditor({
  project,
}: {
  project: { id: string; name: string; brief: string; status: string };
}) {
  return (
    <RecordDialog
      title="Edit project"
      description="Name, brief, and lifecycle status."
      action={updateProjectAction}
      submitLabel="Save changes"
      trigger={
        <Button variant="outline" size="sm">
          Edit project
        </Button>
      }
    >
      <HiddenFields fields={{ projectId: project.id }} />
      <Field label="Name" htmlFor="project-edit-name">
        <TextInput
          id="project-edit-name"
          name="name"
          required
          defaultValue={project.name}
        />
      </Field>
      <Field label="Brief" htmlFor="project-edit-brief">
        <TextArea
          id="project-edit-brief"
          name="brief"
          required
          rows={4}
          defaultValue={project.brief}
        />
      </Field>
      <Field label="Status" htmlFor="project-edit-status">
        <NativeSelect
          id="project-edit-status"
          name="status"
          defaultValue={project.status}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </NativeSelect>
      </Field>
    </RecordDialog>
  );
}
