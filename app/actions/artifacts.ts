"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  MAX_UPLOAD_BYTES,
  saveArtifactFile,
  sha256Hex,
} from "@/lib/artifacts/storage";
import { firmwareMetaSchema } from "@/lib/firmware/meta";
import { prisma } from "@/lib/db";

export type ArtifactUploadState = {
  ok: boolean;
  message: string;
} | null;

const ARTIFACT_KINDS = [
  "schematic",
  "pcb",
  "firmware",
  "datasheet",
  "bom",
  "test",
  "decision",
  "doc",
] as const;

const uploadSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(ARTIFACT_KINDS),
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  version: z.string().trim().min(1, "Version is required."),
  markCurrent: z.boolean().default(false),
  fwTarget: z.string().trim().optional(),
  fwProfile: z.string().trim().optional(),
});

export async function uploadArtifactAction(
  _previous: ArtifactUploadState,
  formData: FormData,
): Promise<ArtifactUploadState> {
  const parsed = uploadSchema.safeParse({
    projectId: formData.get("projectId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    version: formData.get("version"),
    markCurrent: formData.get("markCurrent") === "1",
    fwTarget: formData.get("fwTarget") || undefined,
    fwProfile: formData.get("fwProfile") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the upload.",
    };
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true },
  });
  if (!project) {
    return { ok: false, message: "Project not found." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "File is larger than 10 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const artifactId = randomUUID();
  const hash = `sha256:${sha256Hex(bytes)}`;

  let metaJson: string;
  if (parsed.data.kind === "firmware") {
    const firmware = firmwareMetaSchema.safeParse({
      target: parsed.data.fwTarget || parsed.data.name,
      version: parsed.data.version,
      profile: parsed.data.fwProfile || "release",
      sizeBytes: bytes.length,
      checksum: hash,
    });
    if (!firmware.success) {
      return {
        ok: false,
        message:
          firmware.error.issues[0]?.message ?? "Check the firmware details.",
      };
    }
    metaJson = JSON.stringify(firmware.data, null, 2);
  } else {
    metaJson = JSON.stringify(
      {
        originalName: file.name,
        sizeBytes: bytes.length,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  const saved = await saveArtifactFile({
    projectId: parsed.data.projectId,
    artifactId,
    fileName: file.name,
    bytes,
  });

  await prisma.$transaction(async (tx) => {
    if (parsed.data.markCurrent) {
      await tx.artifact.updateMany({
        where: {
          projectId: parsed.data.projectId,
          kind: parsed.data.kind,
          name: parsed.data.name,
        },
        data: { current: false },
      });
    }

    await tx.artifact.create({
      data: {
        id: artifactId,
        projectId: parsed.data.projectId,
        kind: parsed.data.kind,
        name: parsed.data.name,
        version: parsed.data.version,
        hash,
        metaJson,
        current: parsed.data.markCurrent,
        fileName: saved.fileName,
        filePath: saved.relativePath,
        fileSize: bytes.length,
        mimeType: file.type || "application/octet-stream",
      },
    });
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, message: `Uploaded ${saved.fileName}.` };
}
