import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import test from "node:test";

import {
  deleteArtifactFile,
  readArtifactFile,
  safeUploadFileName,
  saveArtifactFile,
  sha256Hex,
} from "@/lib/artifacts/storage";

test("uploaded files round-trip and hash deterministically", async () => {
  const previous = process.env.HARMOS_UPLOAD_DIR;
  process.env.HARMOS_UPLOAD_DIR = "/tmp/opencode/harmos-upload-test";

  try {
    const bytes = new TextEncoder().encode("firmware-bytes");
    const saved = await saveArtifactFile({
      projectId: "proj-1",
      artifactId: "art-1",
      fileName: "../Tank Firmware.bin",
      bytes,
    });

    assert.equal(saved.fileName, "Tank-Firmware.bin");
    assert.deepEqual(new Uint8Array(await readArtifactFile(saved.relativePath)), bytes);
    assert.match(sha256Hex(bytes), /^[a-f0-9]{64}$/);

    await deleteArtifactFile(saved.relativePath);
    await assert.rejects(readArtifactFile(saved.relativePath));
  } finally {
    if (previous === undefined) delete process.env.HARMOS_UPLOAD_DIR;
    else process.env.HARMOS_UPLOAD_DIR = previous;
    await rm("/tmp/opencode/harmos-upload-test", { recursive: true, force: true });
  }
});

test("file names cannot traverse directories", () => {
  assert.equal(safeUploadFileName("../../secret.txt"), "secret.txt");
  assert.equal(safeUploadFileName("my file?.bin"), "my-file-.bin");
});
