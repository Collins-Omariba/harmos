import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function uploadRoot(): string {
  return path.resolve(
    process.cwd(),
    process.env.HARMOS_UPLOAD_DIR ?? "./data/uploads",
  );
}

export function safeUploadFileName(raw: string): string {
  const base = path.basename(raw || "upload.bin");
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "upload.bin";
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function resolveInsideRoot(relativePath: string): string {
  const root = uploadRoot();
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("artifact_path_outside_upload_root");
  }
  return resolved;
}

export async function saveArtifactFile(input: {
  projectId: string;
  artifactId: string;
  fileName: string;
  bytes: Uint8Array;
}): Promise<{ relativePath: string; fileName: string }> {
  const fileName = safeUploadFileName(input.fileName);
  const relativePath = path.join(input.projectId, input.artifactId, fileName);
  const target = resolveInsideRoot(relativePath);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.bytes);

  return { relativePath, fileName };
}

export async function readArtifactFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveInsideRoot(relativePath));
}

export async function deleteArtifactFile(
  relativePath: string | null | undefined,
): Promise<void> {
  if (!relativePath) return;
  try {
    await unlink(resolveInsideRoot(relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
