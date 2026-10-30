"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProjectAccess, requireSessionUser } from "@/lib/auth/users";
import { explainChangeImpact } from "@/lib/ai/tasks/explain_change_impact";
import { catalogToComponentInput } from "@/lib/bom/fromCatalog";
import { catalog } from "@/lib/catalog";
import { loadProjectGraph } from "@/lib/graph/project-graph";
import {
  computeRipple,
  deterministicImpactSummary,
  nodeKey,
} from "@/lib/graph/ripple";
import { prisma } from "@/lib/db";

export type GraphActionState = {
  ok: boolean;
  message: string;
} | null;

export type ImpactAffectedArtifact = {
  id: string;
  label: string;
  detail: string;
  kind: string;
  depth: number;
  path: string[];
  via: string[];
};

export type ImpactPreviewResult =
  | {
      ok: true;
      componentId: string;
      catalogPartId: string;
      fromLabel: string;
      toLabel: string;
      affected: ImpactAffectedArtifact[];
      explanation: string;
      source: "ai" | "computed";
    }
  | { ok: false; message: string };

function fail(message: string): GraphActionState {
  return { ok: false, message };
}

function done(projectId: string, message: string): GraphActionState {
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message };
}

const id = z.string().min(1);
const ARTIFACT_EDGE_KINDS = [
  "informs",
  "documents",
  "depends_on",
  "uses",
  "tested_by",
  "generated_from",
] as const;
const COMPONENT_LINK_KINDS = [
  "feeds",
  "uses",
  "documents",
  "powers",
  "controls",
] as const;

const artifactEdgeSchema = z.object({
  projectId: id,
  fromArtifactId: id,
  toArtifactId: id,
  kind: z.enum(ARTIFACT_EDGE_KINDS),
});

const componentLinkSchema = z.object({
  projectId: id,
  componentId: id,
  artifactId: id,
  kind: z.enum(COMPONENT_LINK_KINDS),
});

export async function createArtifactEdgeAction(
  _previous: GraphActionState,
  formData: FormData,
): Promise<GraphActionState> {
  const sessionUser = await requireSessionUser();
  {
    const scopedProjectId = String(formData.get("projectId") ?? "");
    if (
      scopedProjectId &&
      !(await requireProjectAccess(sessionUser.id, scopedProjectId))
    ) {
      return fail("You don't have access to this project.");
    }
  }
  const parsed = artifactEdgeSchema.safeParse({
    projectId: formData.get("projectId"),
    fromArtifactId: formData.get("fromArtifactId"),
    toArtifactId: formData.get("toArtifactId"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the edge.");
  }
  if (parsed.data.fromArtifactId === parsed.data.toArtifactId) {
    return fail("An artifact cannot depend on itself.");
  }

  const count = await prisma.artifact.count({
    where: {
      projectId: parsed.data.projectId,
      id: { in: [parsed.data.fromArtifactId, parsed.data.toArtifactId] },
    },
  });
  if (count !== 2) {
    return fail("Both artifacts must belong to this project.");
  }

  const duplicate = await prisma.edge.findFirst({
    where: {
      projectId: parsed.data.projectId,
      fromArtifactId: parsed.data.fromArtifactId,
      toArtifactId: parsed.data.toArtifactId,
      kind: parsed.data.kind,
    },
  });
  if (duplicate) {
    return fail("That edge already exists.");
  }

  await prisma.edge.create({ data: parsed.data });
  return done(parsed.data.projectId, "Artifact edge added.");
}

export async function deleteArtifactEdgeAction(
  _previous: GraphActionState,
  formData: FormData,
): Promise<GraphActionState> {
  const sessionUser = await requireSessionUser();
  {
    const scopedProjectId = String(formData.get("projectId") ?? "");
    if (
      scopedProjectId &&
      !(await requireProjectAccess(sessionUser.id, scopedProjectId))
    ) {
      return fail("You don't have access to this project.");
    }
  }
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");
  const deleted = await prisma.edge.deleteMany({
    where: { id: recordId, projectId },
  });

  return deleted.count === 0
    ? fail("Edge not found in this project.")
    : done(projectId, "Artifact edge removed.");
}

export async function createComponentLinkAction(
  _previous: GraphActionState,
  formData: FormData,
): Promise<GraphActionState> {
  const sessionUser = await requireSessionUser();
  {
    const scopedProjectId = String(formData.get("projectId") ?? "");
    if (
      scopedProjectId &&
      !(await requireProjectAccess(sessionUser.id, scopedProjectId))
    ) {
      return fail("You don't have access to this project.");
    }
  }
  const parsed = componentLinkSchema.safeParse({
    projectId: formData.get("projectId"),
    componentId: formData.get("componentId"),
    artifactId: formData.get("artifactId"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the link.");
  }

  const [componentCount, artifactCount] = await Promise.all([
    prisma.component.count({
      where: { id: parsed.data.componentId, projectId: parsed.data.projectId },
    }),
    prisma.artifact.count({
      where: { id: parsed.data.artifactId, projectId: parsed.data.projectId },
    }),
  ]);
  if (componentCount !== 1 || artifactCount !== 1) {
    return fail("Component and artifact must belong to this project.");
  }

  const duplicate = await prisma.componentArtifactLink.findFirst({
    where: {
      projectId: parsed.data.projectId,
      componentId: parsed.data.componentId,
      artifactId: parsed.data.artifactId,
      kind: parsed.data.kind,
    },
  });
  if (duplicate) {
    return fail("That component link already exists.");
  }

  await prisma.componentArtifactLink.create({ data: parsed.data });
  return done(parsed.data.projectId, "Component link added.");
}

export async function deleteComponentLinkAction(
  _previous: GraphActionState,
  formData: FormData,
): Promise<GraphActionState> {
  const sessionUser = await requireSessionUser();
  {
    const scopedProjectId = String(formData.get("projectId") ?? "");
    if (
      scopedProjectId &&
      !(await requireProjectAccess(sessionUser.id, scopedProjectId))
    ) {
      return fail("You don't have access to this project.");
    }
  }
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");
  const deleted = await prisma.componentArtifactLink.deleteMany({
    where: { id: recordId, projectId },
  });

  return deleted.count === 0
    ? fail("Component link not found in this project.")
    : done(projectId, "Component link removed.");
}

const swapSchema = z.object({
  projectId: id,
  componentId: id,
  catalogPartId: id,
});

type SwapLoad =
  | {
      ok: true;
      loaded: NonNullable<Awaited<ReturnType<typeof loadProjectGraph>>>;
      component: NonNullable<Awaited<ReturnType<typeof prisma.component.findFirst>>>;
      replacement: NonNullable<Awaited<ReturnType<typeof catalog.getPart>>>;
      ripple: NonNullable<ReturnType<typeof computeRipple>>;
    }
  | { ok: false; error: string };

async function loadSwap(input: z.infer<typeof swapSchema>): Promise<SwapLoad> {
  const loaded = await loadProjectGraph(input.projectId);
  if (!loaded) {
    return { ok: false, error: "Project not found." };
  }

  const component = await prisma.component.findFirst({
    where: { id: input.componentId, projectId: input.projectId },
  });
  if (!component) {
    return { ok: false, error: "Component not found in this project." };
  }

  const replacement = await catalog.getPart(input.catalogPartId);
  if (!replacement) {
    return { ok: false, error: "Replacement catalog part not found." };
  }

  const ripple = computeRipple(loaded.graph, {
    type: "component",
    id: component.id,
  });
  if (!ripple) {
    return { ok: false, error: "Component is missing from the project graph." };
  }

  return { ok: true, loaded, component, replacement, ripple };
}

export async function previewComponentSwapAction(input: {
  projectId: string;
  componentId: string;
  catalogPartId: string;
}): Promise<ImpactPreviewResult> {
  const sessionUser = await requireSessionUser();
  if (!(await requireProjectAccess(sessionUser.id, input.projectId))) {
    return { ok: false, message: "You don't have access to this project." };
  }
  const parsed = swapSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a component and a replacement part." };
  }

  const loadedSwap = await loadSwap(parsed.data);
  if (!loadedSwap.ok) {
    return { ok: false, message: loadedSwap.error };
  }

  const { loaded, component, replacement, ripple } = loadedSwap;
  const affected = ripple.affected
    .filter((step) => step.node.type === "artifact")
    .map((step) => ({
      id: step.node.id,
      label: step.node.label,
      detail: step.node.detail,
      kind: step.node.kind,
      depth: step.depth,
      path: step.path,
      via: step.via,
    }));

  const affectedKeys = new Set(affected.map((artifact) => `artifact:${artifact.id}`));
  const visitedKeys = new Set([
    nodeKey({ type: "component", id: component.id }),
    ...affectedKeys,
  ]);
  const traversedEdges = loaded.graph.edges
    .filter(
      (edge) =>
        visitedKeys.has(nodeKey(edge.from)) && affectedKeys.has(nodeKey(edge.to)),
    )
    .map((edge) => {
      const from = loaded.graph.nodes.find(
        (node) => node.type === edge.from.type && node.id === edge.from.id,
      );
      const to = loaded.graph.nodes.find(
        (node) => node.type === edge.to.type && node.id === edge.to.id,
      );
      return {
        from: from?.label ?? edge.from.id,
        to: to?.label ?? edge.to.id,
        kind: edge.kind,
      };
    });

  let explanation = deterministicImpactSummary(ripple);
  let source: "ai" | "computed" = "computed";

  try {
    const explained = await explainChangeImpact({
      componentSwap: {
        projectName: loaded.project.name,
        from: {
          id: component.id,
          label: component.partNumber,
          detail: `${component.manufacturer} · ${component.package}`,
        },
        to: {
          id: replacement.id,
          label: replacement.partNumber,
          detail: `${replacement.manufacturer} · ${replacement.package}`,
        },
      },
      edges: traversedEdges,
      affectedArtifacts: affected.map((artifact) => ({
        id: artifact.id,
        label: artifact.label,
        detail: artifact.detail,
        depth: artifact.depth,
        path: artifact.path,
      })),
    });
    explanation = explained.reasoning;
    source = "ai";
  } catch {
    // The computed ripple is complete without the model. Keep the preview
    // usable offline and label the prose as computed in the UI.
  }

  return {
    ok: true,
    componentId: component.id,
    catalogPartId: replacement.id,
    fromLabel: component.partNumber,
    toLabel: replacement.partNumber,
    affected,
    explanation,
    source,
  };
}

export async function applyComponentSwapAction(input: {
  projectId: string;
  componentId: string;
  catalogPartId: string;
}): Promise<GraphActionState> {
  const sessionUser = await requireSessionUser();
  if (!(await requireProjectAccess(sessionUser.id, input.projectId))) {
    return fail("You don't have access to this project.");
  }
  const parsed = swapSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Choose a component and a replacement part.");
  }

  const loadedSwap = await loadSwap(parsed.data);
  if (!loadedSwap.ok) {
    return fail(loadedSwap.error);
  }

  const { component, replacement, ripple } = loadedSwap;

  if (component.partNumber !== replacement.partNumber) {
    const duplicate = await prisma.component.findFirst({
      where: {
        projectId: parsed.data.projectId,
        partNumber: replacement.partNumber,
        id: { not: component.id },
      },
    });
    if (duplicate) {
      return fail(`${replacement.partNumber} is already in this project's BOM.`);
    }
  }

  const mapped = catalogToComponentInput(replacement, component.quantity);

  await prisma.component.update({
    where: { id: component.id },
    data: {
      partNumber: mapped.partNumber,
      manufacturer: mapped.manufacturer,
      package: mapped.package,
      datasheetUrl: mapped.datasheetUrl,
      notes: mapped.notes,
      unitPriceCents: mapped.unitPriceCents,
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return {
    ok: true,
    message: `Swapped ${component.partNumber} for ${replacement.partNumber}. ${ripple.affected.length} graph item${ripple.affected.length === 1 ? "" : "s"} should be rechecked.`,
  };
}
