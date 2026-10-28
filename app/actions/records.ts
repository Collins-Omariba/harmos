"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dollarsToCents } from "@/lib/bom/totals";
import { parseConstraintValue } from "@/lib/comparison/constraints";
import type { ComparisonOperator } from "@/lib/comparison/types";
import { prisma } from "@/lib/db";

export type RecordActionState = {
  ok: boolean;
  message: string;
} | null;

const idSchema = z.string().min(1);

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
}

function fail(message: string): RecordActionState {
  return { ok: false, message };
}

function done(projectId: string, message: string): RecordActionState {
  revalidate(projectId);
  return { ok: true, message };
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  projectId: idSchema,
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  brief: z.string().trim().min(20, "Brief must be at least 20 characters."),
  status: z.enum(["active", "draft", "archived"]),
});

export async function updateProjectAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = projectSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    brief: formData.get("brief"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the project fields.");
  }

  await prisma.project.update({
    where: { id: parsed.data.projectId },
    data: {
      name: parsed.data.name,
      brief: parsed.data.brief,
      status: parsed.data.status,
    },
  });

  return done(parsed.data.projectId, "Project updated.");
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

const requirementSchema = z.object({
  projectId: idSchema,
  text: z.string().trim().min(4, "Requirement text is too short."),
  kind: z.enum(["mandatory", "preference", "unknown"]),
  status: z.enum(["confirmed", "assumed", "needs_clarification"]),
});

export async function createRequirementAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = requirementSchema.safeParse({
    projectId: formData.get("projectId"),
    text: formData.get("text"),
    kind: formData.get("kind"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the requirement.");
  }

  await prisma.requirement.create({ data: parsed.data });

  return done(parsed.data.projectId, "Requirement added.");
}

export async function updateRequirementAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = requirementSchema
    .extend({ recordId: idSchema })
    .safeParse({
      recordId: formData.get("recordId"),
      projectId: formData.get("projectId"),
      text: formData.get("text"),
      kind: formData.get("kind"),
      status: formData.get("status"),
    });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the requirement.");
  }

  const updated = await prisma.requirement.updateMany({
    where: { id: parsed.data.recordId, projectId: parsed.data.projectId },
    data: {
      text: parsed.data.text,
      kind: parsed.data.kind,
      status: parsed.data.status,
    },
  });

  if (updated.count === 0) {
    return fail("Requirement not found in this project.");
  }

  return done(parsed.data.projectId, "Requirement updated.");
}

export async function deleteRequirementAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.requirement.deleteMany({
    where: { id: recordId, projectId },
  });

  if (deleted.count === 0) {
    return fail("Requirement not found in this project.");
  }

  return done(projectId, "Requirement deleted.");
}

// ---------------------------------------------------------------------------
// Comparison constraints
// ---------------------------------------------------------------------------

const constraintSchema = z.object({
  projectId: idSchema,
  label: z.string().trim().min(4, "Label is too short."),
  metric: z.string().min(1, "Choose a metric."),
  operator: z.string().min(1, "Choose an operator."),
  value: z.string().trim().min(1, "Enter a value."),
  unit: z.string().trim().max(12).optional(),
  kind: z.enum(["mandatory", "preference"]),
});

export async function createConstraintAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = constraintSchema.safeParse({
    projectId: formData.get("projectId"),
    label: formData.get("label"),
    metric: formData.get("metric"),
    operator: formData.get("operator"),
    value: formData.get("value"),
    unit: formData.get("unit") || undefined,
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the constraint.");
  }

  const value = parseConstraintValue(
    parsed.data.metric,
    parsed.data.operator,
    parsed.data.value,
  );

  if ("error" in value) {
    return fail(value.error);
  }

  const position =
    (await prisma.comparisonConstraint.count({
      where: { projectId: parsed.data.projectId },
    })) + 1;

  await prisma.comparisonConstraint.create({
    data: {
      projectId: parsed.data.projectId,
      label: parsed.data.label,
      metric: parsed.data.metric,
      operator: parsed.data.operator as ComparisonOperator,
      valueJson: JSON.stringify(value.value),
      unit: parsed.data.unit || null,
      kind: parsed.data.kind,
      position,
    },
  });

  return done(parsed.data.projectId, "Constraint added. Re-run the comparison to apply it.");
}

export async function updateConstraintAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = constraintSchema
    .extend({ recordId: idSchema })
    .safeParse({
      recordId: formData.get("recordId"),
      projectId: formData.get("projectId"),
      label: formData.get("label"),
      metric: formData.get("metric"),
      operator: formData.get("operator"),
      value: formData.get("value"),
      unit: formData.get("unit") || undefined,
      kind: formData.get("kind"),
    });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the constraint.");
  }

  const value = parseConstraintValue(
    parsed.data.metric,
    parsed.data.operator,
    parsed.data.value,
  );

  if ("error" in value) {
    return fail(value.error);
  }

  const updated = await prisma.comparisonConstraint.updateMany({
    where: { id: parsed.data.recordId, projectId: parsed.data.projectId },
    data: {
      label: parsed.data.label,
      metric: parsed.data.metric,
      operator: parsed.data.operator,
      valueJson: JSON.stringify(value.value),
      unit: parsed.data.unit || null,
      kind: parsed.data.kind,
    },
  });

  if (updated.count === 0) {
    return fail("Constraint not found in this project.");
  }

  return done(parsed.data.projectId, "Constraint updated. Re-run the comparison to apply it.");
}

export async function deleteConstraintAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.comparisonConstraint.deleteMany({
    where: { id: recordId, projectId },
  });

  if (deleted.count === 0) {
    return fail("Constraint not found in this project.");
  }

  return done(projectId, "Constraint deleted.");
}

// ---------------------------------------------------------------------------
// Components (selected parts + BOM fields)
// ---------------------------------------------------------------------------

const componentSchema = z.object({
  projectId: idSchema,
  partNumber: z.string().trim().min(1, "Part number is required."),
  manufacturer: z.string().trim().min(1, "Manufacturer is required."),
  package: z.string().trim().min(1, "Package is required."),
  datasheetUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(z.string().url("Datasheet must be a URL.").optional()),
  notes: z.string().trim().max(2000).optional(),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(0, "Quantity cannot be negative.")
    .max(1000000, "Quantity is unrealistically large."),
  unitPrice: z.string().trim(),
});

export async function createComponentAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = componentSchema.safeParse({
    projectId: formData.get("projectId"),
    partNumber: formData.get("partNumber"),
    manufacturer: formData.get("manufacturer"),
    package: formData.get("package"),
    datasheetUrl: formData.get("datasheetUrl") || undefined,
    notes: formData.get("notes") || undefined,
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice") ?? "",
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the component.");
  }

  const unitPriceCents = dollarsToCents(parsed.data.unitPrice);

  if (parsed.data.unitPrice.trim() !== "" && unitPriceCents === null) {
    return fail('Unit price must look like "12.50". Leave it empty if unknown.');
  }

  await prisma.component.create({
    data: {
      projectId: parsed.data.projectId,
      partNumber: parsed.data.partNumber,
      manufacturer: parsed.data.manufacturer,
      package: parsed.data.package,
      datasheetUrl: parsed.data.datasheetUrl,
      notes: parsed.data.notes || null,
      quantity: parsed.data.quantity,
      unitPriceCents,
    },
  });

  return done(parsed.data.projectId, "Component added to the BOM.");
}

export async function updateComponentAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = componentSchema
    .extend({ recordId: idSchema })
    .safeParse({
      recordId: formData.get("recordId"),
      projectId: formData.get("projectId"),
      partNumber: formData.get("partNumber"),
      manufacturer: formData.get("manufacturer"),
      package: formData.get("package"),
      datasheetUrl: formData.get("datasheetUrl") || undefined,
      notes: formData.get("notes") || undefined,
      quantity: formData.get("quantity"),
      unitPrice: formData.get("unitPrice") ?? "",
    });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the component.");
  }

  const unitPriceCents = dollarsToCents(parsed.data.unitPrice);

  if (parsed.data.unitPrice.trim() !== "" && unitPriceCents === null) {
    return fail('Unit price must look like "12.50". Leave it empty if unknown.');
  }

  const updated = await prisma.component.updateMany({
    where: { id: parsed.data.recordId, projectId: parsed.data.projectId },
    data: {
      partNumber: parsed.data.partNumber,
      manufacturer: parsed.data.manufacturer,
      package: parsed.data.package,
      datasheetUrl: parsed.data.datasheetUrl ?? null,
      notes: parsed.data.notes || null,
      quantity: parsed.data.quantity,
      unitPriceCents,
    },
  });

  if (updated.count === 0) {
    return fail("Component not found in this project.");
  }

  return done(parsed.data.projectId, "Component updated.");
}

export async function deleteComponentAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.component.deleteMany({
    where: { id: recordId, projectId },
  });

  if (deleted.count === 0) {
    return fail("Component not found in this project.");
  }

  return done(projectId, "Component removed from the BOM.");
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

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

const artifactSchema = z.object({
  projectId: idSchema,
  kind: z.enum(ARTIFACT_KINDS),
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  version: z.string().trim().min(1, "Version is required."),
  hash: z.string().trim().min(4, "Hash is too short to identify a version."),
  metaJson: z
    .string()
    .trim()
    .min(1, "Metadata is required.")
    .refine(
      (value) => {
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Metadata must be valid JSON." },
    ),
});

export async function createArtifactAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = artifactSchema.safeParse({
    projectId: formData.get("projectId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    version: formData.get("version"),
    hash: formData.get("hash"),
    metaJson: formData.get("metaJson"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the artifact.");
  }

  await prisma.artifact.create({ data: parsed.data });

  return done(parsed.data.projectId, "Artifact recorded.");
}

export async function updateArtifactAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = artifactSchema
    .extend({ recordId: idSchema })
    .safeParse({
      recordId: formData.get("recordId"),
      projectId: formData.get("projectId"),
      kind: formData.get("kind"),
      name: formData.get("name"),
      version: formData.get("version"),
      hash: formData.get("hash"),
      metaJson: formData.get("metaJson"),
    });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the artifact.");
  }

  const updated = await prisma.artifact.updateMany({
    where: { id: parsed.data.recordId, projectId: parsed.data.projectId },
    data: {
      kind: parsed.data.kind,
      name: parsed.data.name,
      version: parsed.data.version,
      hash: parsed.data.hash,
      metaJson: parsed.data.metaJson,
    },
  });

  if (updated.count === 0) {
    return fail("Artifact not found in this project.");
  }

  return done(parsed.data.projectId, "Artifact updated.");
}

export async function deleteArtifactAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.artifact.deleteMany({
    where: { id: recordId, projectId },
  });

  if (deleted.count === 0) {
    return fail("Artifact not found in this project.");
  }

  return done(projectId, "Artifact deleted.");
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

const decisionSchema = z.object({
  projectId: idSchema,
  title: z.string().trim().min(4, "Title is too short."),
  rationale: z.string().trim().min(10, "Rationale needs a sentence or two."),
  decidedAt: z.string().min(1, "Decision date is required."),
});

export async function createDecisionAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = decisionSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    rationale: formData.get("rationale"),
    decidedAt: formData.get("decidedAt"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the decision.");
  }

  const decidedAt = new Date(parsed.data.decidedAt);

  if (Number.isNaN(decidedAt.getTime())) {
    return fail("Decision date is not a valid date.");
  }

  await prisma.decision.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      rationale: parsed.data.rationale,
      decidedAt,
    },
  });

  return done(parsed.data.projectId, "Decision recorded.");
}

export async function updateDecisionAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = decisionSchema
    .extend({ recordId: idSchema })
    .safeParse({
      recordId: formData.get("recordId"),
      projectId: formData.get("projectId"),
      title: formData.get("title"),
      rationale: formData.get("rationale"),
      decidedAt: formData.get("decidedAt"),
    });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the decision.");
  }

  const decidedAt = new Date(parsed.data.decidedAt);

  if (Number.isNaN(decidedAt.getTime())) {
    return fail("Decision date is not a valid date.");
  }

  const updated = await prisma.decision.updateMany({
    where: { id: parsed.data.recordId, projectId: parsed.data.projectId },
    data: {
      title: parsed.data.title,
      rationale: parsed.data.rationale,
      decidedAt,
    },
  });

  if (updated.count === 0) {
    return fail("Decision not found in this project.");
  }

  return done(parsed.data.projectId, "Decision updated.");
}

export async function deleteDecisionAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.decision.deleteMany({
    where: { id: recordId, projectId },
  });

  if (deleted.count === 0) {
    return fail("Decision not found in this project.");
  }

  return done(projectId, "Decision deleted.");
}

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------

const validationTestSchema = z.object({
  projectId: idSchema,
  name: z.string().trim().min(4, "Test name is too short."),
  status: z.enum(["pending", "pass", "fail", "blocked"]),
  notes: z.string().trim().max(2000).optional(),
});

export async function createValidationTestAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = validationTestSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the test.");
  }

  await prisma.validationTest.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      status: parsed.data.status,
      notes: parsed.data.notes || "",
    },
  });

  return done(parsed.data.projectId, "Validation test added.");
}

export async function updateValidationTestAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const parsed = validationTestSchema
    .extend({ recordId: idSchema })
    .safeParse({
      recordId: formData.get("recordId"),
      projectId: formData.get("projectId"),
      name: formData.get("name"),
      status: formData.get("status"),
      notes: formData.get("notes") || undefined,
    });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the test.");
  }

  const updated = await prisma.validationTest.updateMany({
    where: { id: parsed.data.recordId, projectId: parsed.data.projectId },
    data: {
      name: parsed.data.name,
      status: parsed.data.status,
      notes: parsed.data.notes || "",
    },
  });

  if (updated.count === 0) {
    return fail("Test not found in this project.");
  }

  return done(parsed.data.projectId, "Validation test updated.");
}

export async function deleteValidationTestAction(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.validationTest.deleteMany({
    where: { id: recordId, projectId },
  });

  if (deleted.count === 0) {
    return fail("Test not found in this project.");
  }

  return done(projectId, "Validation test deleted.");
}
