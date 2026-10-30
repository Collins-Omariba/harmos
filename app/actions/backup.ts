"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildProjectImportPlan,
  type ProjectExport,
} from "@/lib/backup/project-transfer";
import { prisma } from "@/lib/db";

export type BackupActionState = {
  ok: boolean;
  message: string;
} | null;

export type ExportResult =
  | { ok: true; filename: string; content: string }
  | { ok: false; message: string };

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function projectExportData(projectId: string): Promise<ProjectExport | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: true,
      comparisonConstraints: true,
      components: true,
      artifacts: true,
      edges: true,
      componentLinks: true,
      decisions: true,
      validationTests: true,
      resources: true,
      comparisonRuns: true,
      comparisonCandidates: true,
    },
  });

  if (!project) return null;

  const { id, name, brief, status, createdAt, updatedAt, ...children } = project;
  void id; void name; void brief; void status; void createdAt; void updatedAt;

  return JSON.parse(
    JSON.stringify({
      format: "harmos-project-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        brief: project.brief,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      requirements: children.requirements,
      comparisonConstraints: children.comparisonConstraints,
      components: children.components,
      artifacts: children.artifacts,
      edges: children.edges,
      componentLinks: children.componentLinks,
      decisions: children.decisions,
      validationTests: children.validationTests,
      resources: children.resources,
      comparisonRuns: children.comparisonRuns,
      comparisonCandidates: children.comparisonCandidates,
    }),
  ) as ProjectExport;
}

export async function exportProjectAction(
  projectId: string,
): Promise<ExportResult> {
  const data = await projectExportData(projectId);
  if (!data) {
    return { ok: false, message: "Project not found." };
  }

  return {
    ok: true,
    filename: `harmos-project-${projectId}-${fileStamp()}.json`,
    content: JSON.stringify(data, null, 2),
  };
}

export async function exportWorkspaceAction(): Promise<ExportResult> {
  const projects = await prisma.project.findMany({ select: { id: true } });
  const exports = [];
  for (const project of projects) {
    const data = await projectExportData(project.id);
    if (data) exports.push(data);
  }

  const [catalogParts, catalogProposals] = await Promise.all([
    prisma.catalogPart.findMany(),
    prisma.catalogProposal.findMany(),
  ]);

  return {
    ok: true,
    filename: `harmos-workspace-${fileStamp()}.json`,
    content: JSON.stringify(
      {
        format: "harmos-workspace-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        projects: exports,
        catalogParts,
        catalogProposals,
      },
      null,
      2,
    ),
  };
}

export async function importProjectAction(
  _previous: BackupActionState,
  formData: FormData,
): Promise<BackupActionState> {
  const raw = String(formData.get("projectJson") ?? "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "That file is not valid JSON." };
  }

  const newProjectId = `proj-${randomUUID()}`;
  let plan;
  try {
    plan = buildProjectImportPlan(parsed, newProjectId, () => randomUUID());
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Import file is not a Harmos project export: ${error.message.slice(0, 160)}`
          : "Import file is not a Harmos project export.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.create({ data: plan.project });
      if (plan.requirements.length) {
        await tx.requirement.createMany({ data: plan.requirements as never[] });
      }
      if (plan.comparisonConstraints.length) {
        await tx.comparisonConstraint.createMany({
          data: plan.comparisonConstraints as never[],
        });
      }
      if (plan.components.length) {
        await tx.component.createMany({ data: plan.components as never[] });
      }
      if (plan.artifacts.length) {
        await tx.artifact.createMany({ data: plan.artifacts as never[] });
      }
      if (plan.edges.length) {
        await tx.edge.createMany({ data: plan.edges as never[] });
      }
      if (plan.componentLinks.length) {
        await tx.componentArtifactLink.createMany({
          data: plan.componentLinks as never[],
        });
      }
      if (plan.decisions.length) {
        await tx.decision.createMany({ data: plan.decisions as never[] });
      }
      if (plan.validationTests.length) {
        await tx.validationTest.createMany({
          data: plan.validationTests as never[],
        });
      }
      if (plan.resources.length) {
        await tx.resource.createMany({ data: plan.resources as never[] });
      }
      if (plan.comparisonRuns.length) {
        await tx.comparisonRun.createMany({
          data: plan.comparisonRuns as never[],
        });
      }
      if (plan.comparisonCandidates.length) {
        await tx.comparisonCandidate.createMany({
          data: plan.comparisonCandidates as never[],
        });
      }
    });
  } catch {
    return { ok: false, message: "Import failed while writing the project." };
  }

  revalidatePath("/");
  redirect(`/projects/${newProjectId}?tab=overview`);
}
