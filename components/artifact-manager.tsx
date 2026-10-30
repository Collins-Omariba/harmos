"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";

import {
  createArtifactAction,
  deleteArtifactAction,
  setCurrentArtifactAction,
  updateArtifactAction,
} from "@/app/actions/records";
import { uploadArtifactAction } from "@/app/actions/artifacts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseFirmwareMeta } from "@/lib/firmware/meta";
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
import {
  metaObjectFromRows,
  metaRowsFromJson,
  type ArtifactMetaRow,
} from "@/lib/artifacts/meta";

type Artifact = {
  id: string;
  kind: string;
  name: string;
  version: string;
  hash: string;
  metaJson: string;
  current: boolean;
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
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

function defaultFirmware(artifact?: Artifact) {
  if (!artifact || artifact.kind !== "firmware") {
    return {
      target: "",
      profile: "release",
      size: "",
      checksum: "",
      hwName: "",
      hwVersion: "",
    };
  }
  const parsed = parseFirmwareMeta(artifact.metaJson);
  if ("error" in parsed) {
    return {
      target: "",
      version: "",
      profile: "release",
      size: "",
      checksum: "",
      hwName: "",
      hwVersion: "",
    };
  }
  return {
    target: parsed.meta.target,
    profile: parsed.meta.profile,
    size:
      parsed.meta.sizeBytes === undefined ? "" : String(parsed.meta.sizeBytes),
    checksum: parsed.meta.checksum ?? "",
    hwName: parsed.meta.targetHardware?.name ?? "",
    hwVersion: parsed.meta.targetHardware?.version ?? "",
  };
}

const META_SUGGESTIONS: Record<string, string[]> = {
  schematic: ["tool", "layers", "sheets"],
  pcb: ["tool", "layers", "finish"],
  datasheet: ["pages", "revision", "source"],
  bom: ["tool", "lines"],
  test: ["rig", "result"],
  decision: ["status", "reviewer"],
  doc: ["pages", "source"],
};

function MetaFields({ artifact, kind }: { artifact?: Artifact; kind: string }) {
  const [rows, setRows] = useState<ArtifactMetaRow[]>(() =>
    metaRowsFromJson(artifact?.metaJson),
  );
  const id = artifact ? `artifact-${artifact.id}` : "artifact-new";

  function setRow(index: number, patch: Partial<ArtifactMetaRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow(prefill = "") {
    setRows((current) => [...current, { key: prefill, value: "" }]);
  }

  function removeRow(index: number) {
    setRows((current) =>
      current.length <= 1
        ? [{ key: "", value: "" }]
        : current.filter((_, i) => i !== index),
    );
  }

  const suggestions = (META_SUGGESTIONS[kind] ?? []).filter(
    (key) => !rows.some((row) => row.key.trim() === key),
  );

  return (
    <div className="space-y-1.5">
      <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Details
      </span>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <TextInput
              aria-label={`Detail name ${index + 1}`}
              value={row.key}
              onChange={(event) => setRow(index, { key: event.target.value })}
              placeholder="name — e.g. tool"
              autoComplete="off"
            />
            <TextInput
              aria-label={`Detail value ${index + 1}`}
              value={row.value}
              onChange={(event) => setRow(index, { value: event.target.value })}
              placeholder="value — e.g. KiCad 9"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(index)}
              aria-label={`Remove detail ${index + 1}`}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
          + Add detail
        </Button>
        {suggestions.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => addRow(key)}
            className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            + {key}
          </button>
        ))}
      </div>
      <input
        type="hidden"
        id={`${id}-meta`}
        name="metaJson"
        value={JSON.stringify(metaObjectFromRows(rows))}
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Plain name/value details — numbers are stored as numbers. Firmware
        uses its own structured fields instead.
      </p>
    </div>
  );
}

function ArtifactFields({
  artifact,
  hardwareNames,
}: {
  artifact?: Artifact;
  hardwareNames: string[];
}) {
  const id = artifact ? `artifact-${artifact.id}` : "artifact-new";
  const [kind, setKind] = useState(artifact?.kind ?? "schematic");
  const fw = defaultFirmware(artifact);
  const datalistId = `${id}-hw-names`;
  // Firmware uses the artifact version above as its single version of truth;
  // the separate firmware-version input was a duplicate and is gone.

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind" htmlFor={`${id}-kind`}>
          <select
            id={`${id}-kind`}
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
      <Field
        label={kind === "firmware" ? "Version (vX.Y.Z)" : "Version"}
        htmlFor={`${id}-version`}
      >
        <TextInput
          id={`${id}-version`}
          name="version"
          required
          defaultValue={artifact?.version ?? ""}
          placeholder={kind === "firmware" ? "v0.3.0" : "rev A / v0.3.0"}
        />
      </Field>
      {kind === "firmware" ? (
        <>
          <input type="hidden" name="metaJson" value="{}" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Target MCU / board" htmlFor={`${id}-fw-target`}>
              <TextInput
                id={`${id}-fw-target`}
                name="fw_target"
                required
                defaultValue={fw.target}
                placeholder="ESP32-S3"
              />
            </Field>
            <Field label="Profile" htmlFor={`${id}-fw-profile`}>
              <NativeSelect
                id={`${id}-fw-profile`}
                name="fw_profile"
                defaultValue={fw.profile}
              >
                <option value="release">release</option>
                <option value="debug">debug</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Size (bytes, optional)" htmlFor={`${id}-fw-size`}>
              <TextInput
                id={`${id}-fw-size`}
                name="fw_size"
                inputMode="numeric"
                defaultValue={fw.size}
                placeholder="184320"
              />
            </Field>
            <Field label="Checksum (optional)" htmlFor={`${id}-fw-checksum`}>
              <TextInput
                id={`${id}-fw-checksum`}
                name="fw_checksum"
                defaultValue={fw.checksum}
                placeholder="sha256:…"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Targets hardware (optional)"
              htmlFor={`${id}-fw-hw-name`}
            >
              <TextInput
                id={`${id}-fw-hw-name`}
                name="fw_hw_name"
                list={datalistId}
                defaultValue={fw.hwName}
                placeholder="Tank Monitor Main Board"
                autoComplete="off"
              />
              <datalist id={datalistId}>
                {hardwareNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <Field label="Hardware revision" htmlFor={`${id}-fw-hw-version`}>
              <TextInput
                id={`${id}-fw-hw-version`}
                name="fw_hw_version"
                defaultValue={fw.hwVersion}
                placeholder="rev A"
              />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A named hardware target must already exist in this project at that
            revision — otherwise saving is rejected.
          </p>
        </>
      ) : (
        <MetaFields artifact={artifact} kind={kind} />
      )}
    </>
  );
}

function UploadArtifactDialog({ projectId }: { projectId: string }) {
  const [kind, setKind] = useState("firmware");

  return (
    <RecordDialog
      title="Upload artifact file"
      description="Schematics, firmware binaries, datasheets, BOMs, and test logs up to 10 MB. The SHA-256 is recorded automatically."
      action={uploadArtifactAction}
      submitLabel="Upload file"
      trigger={<AddButton label="Upload file" />}
    >
      <HiddenFields fields={{ projectId }} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind" htmlFor="upload-kind">
          <select
            id="upload-kind"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Name" htmlFor="upload-name">
          <TextInput id="upload-name" name="name" required placeholder="Tank Monitor Firmware" />
        </Field>
      </div>
      <Field label="Version" htmlFor="upload-version">
        <TextInput id="upload-version" name="version" required placeholder={kind === "firmware" ? "v0.4.0" : "rev B"} />
      </Field>
      <Field label="File" htmlFor="upload-file">
        <input
          id="upload-file"
          name="file"
          type="file"
          required
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm file:text-foreground"
        />
      </Field>
      {kind === "firmware" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Target MCU / board" htmlFor="upload-fw-target">
            <TextInput id="upload-fw-target" name="fwTarget" placeholder="ESP32-S3" />
          </Field>
          <Field label="Profile" htmlFor="upload-fw-profile">
            <NativeSelect id="upload-fw-profile" name="fwProfile" defaultValue="release">
              <option value="release">release</option>
              <option value="debug">debug</option>
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="markCurrent" value="1" className="size-4 accent-primary" />
        Mark as current version for this name
      </label>
    </RecordDialog>
  );
}

function SetCurrentButton({
  projectId,
  recordId,
  label,
}: {
  projectId: string;
  recordId: string;
  label: string;
}) {
  const [, formAction] = useActionState(setCurrentArtifactAction, null);

  return (
    <form action={formAction} title={label}>
      <HiddenFields fields={{ projectId, recordId }} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-primary"
        aria-label={label}
      >
        <Star className="size-3.5" />
      </Button>
    </form>
  );
}

function FirmwareLine({
  artifact,
  artifacts,
}: {
  artifact: Artifact;
  artifacts: Artifact[];
}) {
  const parsed = parseFirmwareMeta(artifact.metaJson);
  if ("error" in parsed) {
    return (
      <p className="numeric mt-0.5 text-[11px] text-destructive">
        Invalid firmware metadata — edit to fix.
      </p>
    );
  }

  const meta = parsed.meta;
  const target = meta.targetHardware
    ? artifacts.some(
        (other) =>
          other.name === meta.targetHardware?.name &&
          other.version === meta.targetHardware?.version,
      )
    : null;

  return (
    <div className="numeric mt-0.5 text-[11px] text-muted-foreground">
      <span>
        {meta.target} · {meta.version} · {meta.profile}
        {meta.sizeBytes !== undefined
          ? ` · ${(meta.sizeBytes / 1024).toFixed(0)} KB`
          : ""}
      </span>
      {meta.targetHardware ? (
        target ? (
          <span className="ml-2 text-primary">
            targets {meta.targetHardware.name} @ {meta.targetHardware.version}
          </span>
        ) : (
          <span className="ml-2 text-destructive">
            target {meta.targetHardware.name} @ {meta.targetHardware.version}{" "}
            missing
          </span>
        )
      ) : null}
    </div>
  );
}

export function ArtifactManager({
  projectId,
  artifacts,
}: {
  projectId: string;
  artifacts: Artifact[];
}) {
  const hardwareNames = [
    ...new Set(
      artifacts
        .filter((artifact) => artifact.kind === "schematic" || artifact.kind === "pcb")
        .map((artifact) => artifact.name),
    ),
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        <UploadArtifactDialog projectId={projectId} />
        <RecordDialog
          title="Add artifact"
          description="Versioned files: schematics, firmware, datasheets, BOMs."
          action={createArtifactAction}
          submitLabel="Add artifact"
          trigger={<AddButton label="Add artifact" />}
        >
          <HiddenFields fields={{ projectId }} />
          <ArtifactFields hardwareNames={hardwareNames} />
        </RecordDialog>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {artifacts.length > 0 ? (
          artifacts.map((artifact) => (
            <div key={artifact.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-foreground">
                    {artifact.name}
                    {artifact.current ? (
                      <Badge
                        variant="outline"
                        className="border-primary/35 bg-primary/10 font-mono text-[9px] uppercase tracking-[0.12em] text-primary"
                      >
                        current
                      </Badge>
                    ) : null}
                  </p>
                  <p className="numeric mt-0.5 text-[11px] text-muted-foreground">
                    {artifact.kind} · {artifact.version}
                    {artifact.hash ? ` · ${artifact.hash}` : ""}
                  </p>
                  {artifact.kind === "firmware" ? (
                    <FirmwareLine artifact={artifact} artifacts={artifacts} />
                  ) : null}
                  {artifact.filePath ? (
                    <p className="numeric mt-1 text-[11px]">
                      <a href={`/api/artifacts/${artifact.id}`} className="text-primary underline-offset-4 hover:underline">
                        Download {artifact.fileName ?? "file"}
                      </a>
                      {artifact.fileSize !== null ? ` · ${(artifact.fileSize / 1024).toFixed(1)} KB` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {!artifact.current ? (
                    <SetCurrentButton
                      projectId={projectId}
                      recordId={artifact.id}
                      label={`Mark ${artifact.version} as current`}
                    />
                  ) : null}
                  <RecordDialog
                    title="Edit artifact"
                    description="Bump the version and hash when the file changes."
                    action={updateArtifactAction}
                    submitLabel="Save changes"
                    trigger={<EditButton />}
                  >
                    <HiddenFields fields={{ projectId, recordId: artifact.id }} />
                    <ArtifactFields
                      artifact={artifact}
                      hardwareNames={hardwareNames}
                    />
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
      <p className="numeric mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        One current version per name — marking a new one supersedes the old.
      </p>
    </div>
  );
}
