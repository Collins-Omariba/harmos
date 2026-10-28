import { z } from "zod";

/**
 * Structured firmware metadata. Replaces the old free-form JSON blob: every
 * field is validated on write, so a typo can never silently corrupt a build
 * record. Stored as JSON in Artifact.metaJson for kind == "firmware".
 */

export const firmwareVersionSchema = z
  .string()
  .trim()
  .regex(
    /^v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/,
    'Version must look like "v0.3.0" or "1.2.0-rc.1".',
  );

export const firmwareChecksumSchema = z
  .string()
  .trim()
  .regex(
    /^sha256:[0-9a-fA-F]{8,64}$/,
    'Checksum must look like "sha256:9f2c1a7e…".',
  );

export const firmwareMetaSchema = z.object({
  target: z.string().trim().min(2, "Target MCU/board is required."),
  version: firmwareVersionSchema,
  profile: z.enum(["debug", "release"]),
  sizeBytes: z.coerce
    .number()
    .int("Size must be a whole number of bytes.")
    .min(0, "Size cannot be negative.")
    .optional(),
  checksum: firmwareChecksumSchema.optional().or(z.literal("")),
  targetHardware: z
    .object({
      name: z.string().trim().min(1),
      version: z.string().trim().min(1),
    })
    .optional(),
});

export type FirmwareMeta = z.infer<typeof firmwareMetaSchema>;

/** Parse stored metaJson back into validated firmware metadata. */
export function parseFirmwareMeta(
  raw: string,
): { meta: FirmwareMeta } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { error: "Firmware metadata must be valid JSON." };
  }

  const parsed = firmwareMetaSchema.safeParse(value);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid firmware metadata.",
    };
  }
  return { meta: parsed.data };
}

/** "Board @ rev" label for UI display. */
export function hardwareTargetLabel(meta: {
  targetHardware?: { name: string; version: string };
}): string | null {
  if (!meta.targetHardware) {
    return null;
  }
  return `${meta.targetHardware.name} @ ${meta.targetHardware.version}`;
}
