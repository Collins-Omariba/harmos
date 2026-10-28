"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { selectResources } from "@/lib/ai/tasks/select_resources";
import { catalog } from "@/lib/catalog";
import { liveWebSearch, RESOURCE_KINDS } from "@/lib/research";
import { prisma } from "@/lib/db";

export type ResearchActionState = {
  ok: boolean;
  message: string;
} | null;

function fail(message: string): ResearchActionState {
  return { ok: false, message };
}

function done(projectId: string, message: string): ResearchActionState {
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message };
}

const resourceSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(4, "Title is too short."),
  url: z.string().trim().url("URL must be a valid link."),
  kind: z.enum(RESOURCE_KINDS),
  summary: z.string().trim().min(10, "Summary needs a sentence or two."),
  tags: z.string().trim().max(500),
  retrievedAt: z.string().min(1, "Retrieval date is required."),
});

export async function createResourceAction(
  _previous: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const parsed = resourceSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    url: formData.get("url"),
    kind: formData.get("kind"),
    summary: formData.get("summary"),
    tags: formData.get("tags") ?? "",
    retrievedAt: formData.get("retrievedAt"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the resource.");
  }

  const retrievedAt = new Date(parsed.data.retrievedAt);
  if (Number.isNaN(retrievedAt.getTime())) {
    return fail("Retrieval date is not a valid date.");
  }

  await prisma.resource.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      url: parsed.data.url,
      kind: parsed.data.kind,
      summary: parsed.data.summary,
      retrievedAt,
      tags: parsed.data.tags,
    },
  });

  return done(parsed.data.projectId, "Resource indexed.");
}

export async function updateResourceAction(
  _previous: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const recordId = String(formData.get("recordId") ?? "");
  const parsed = resourceSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    url: formData.get("url"),
    kind: formData.get("kind"),
    summary: formData.get("summary"),
    tags: formData.get("tags") ?? "",
    retrievedAt: formData.get("retrievedAt"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the resource.");
  }

  const retrievedAt = new Date(parsed.data.retrievedAt);
  if (Number.isNaN(retrievedAt.getTime())) {
    return fail("Retrieval date is not a valid date.");
  }

  const updated = await prisma.resource.updateMany({
    where: { id: recordId, projectId: parsed.data.projectId },
    data: {
      title: parsed.data.title,
      url: parsed.data.url,
      kind: parsed.data.kind,
      summary: parsed.data.summary,
      retrievedAt,
      tags: parsed.data.tags,
    },
  });

  if (updated.count === 0) {
    return fail("Resource not found in this project.");
  }

  return done(parsed.data.projectId, "Resource updated.");
}

export async function deleteResourceAction(
  _previous: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");

  const deleted = await prisma.resource.deleteMany({
    where: { id: recordId, projectId },
  });

  if (deleted.count === 0) {
    return fail("Resource not found in this project.");
  }

  return done(projectId, "Resource removed from the index.");
}

export async function setResourceSelectionAction(
  _previous: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");
  const selected = formData.get("selected") === "1";

  const existing = await prisma.resource.findFirst({
    where: { id: recordId, projectId },
  });
  if (!existing) {
    return fail("Resource not found in this project.");
  }

  await prisma.resource.update({
    where: { id: recordId },
    data: {
      selected,
      selectionNote: selected
        ? existing.selectionNote || "Manually selected."
        : "",
    },
  });

  return done(
    projectId,
    selected ? "Marked as selected." : "Removed from the selection.",
  );
}

const importSchema = z.object({
  projectId: z.string().min(1),
  catalogPartIds: z.array(z.string().min(1)).min(1, "Pick at least one part.").max(20),
});

export async function importCatalogResourcesAction(
  _previous: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const parsed = importSchema.safeParse({
    projectId: formData.get("projectId"),
    catalogPartIds: formData.getAll("catalogPartIds"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Pick parts to import.");
  }

  const parts = await catalog.getPartsByIds(parsed.data.catalogPartIds);
  if (parts.length === 0) {
    return fail("No catalog parts found.");
  }

  const existingUrls = new Set(
    (
      await prisma.resource.findMany({
        where: { projectId: parsed.data.projectId },
        select: { url: true },
      })
    ).map((row) => row.url),
  );

  let added = 0;
  for (const part of parts) {
    const entries = [
      {
        title: `${part.partNumber} datasheet`,
        url: part.datasheetUrl,
        kind: "datasheet",
      },
      {
        title: `${part.partNumber} manufacturer page`,
        url: part.sourceUrl,
        kind: "reference" as const,
      },
    ];

    for (const entry of entries) {
      if (existingUrls.has(entry.url)) {
        continue;
      }
      await prisma.resource.create({
        data: {
          projectId: parsed.data.projectId,
          title: entry.title,
          url: entry.url,
          kind: entry.kind,
          summary: part.description,
          retrievedAt: new Date(part.sourceRetrievedAt),
          tags: [part.category, ...part.tags].join(", "),
        },
      });
      existingUrls.add(entry.url);
      added += 1;
    }
  }

  return done(
    parsed.data.projectId,
    added > 0
      ? `Indexed ${added} source${added === 1 ? "" : "s"} from the catalog.`
      : "Those sources are already indexed.",
  );
}

export async function runWebSearchAction(
  projectId: string,
  query: string,
): Promise<ResearchActionState> {
  const trimmed = query.trim();

  if (trimmed.length < 3) {
    return fail("Type a query first.");
  }

  try {
    await liveWebSearch(trimmed);
    return fail("Web search returned nothing usable.");
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "web search failed";
    if (reason === "web_search_disabled") {
      return fail("Web search is off (HARMOS_WEB_SEARCH=0).");
    }
    return fail(
      "Web search is not wired to a provider yet — index sources manually for now.",
    );
  }
}

export async function runResourceSelectionAction(
  projectId: string,
): Promise<ResearchActionState> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: { orderBy: { id: "asc" } },
      resources: { orderBy: { title: "asc" } },
    },
  });

  if (!project) {
    return fail("Project not found.");
  }
  if (project.resources.length === 0) {
    return fail("The index is empty — add or import resources first.");
  }

  let selections: { id: string; note: string }[];
  try {
    const result = await selectResources({
      project: { name: project.name, brief: project.brief },
      requirements: project.requirements.map((requirement) => ({
        text: requirement.text,
        kind: requirement.kind,
        status: requirement.status,
      })),
      index: project.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        kind: resource.kind,
        summary: resource.summary,
        tags: resource.tags
          .split(/[,;]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      })),
    });
    selections = result.selections;
  } catch {
    return fail(
      "AI selection needs an AI key — set AI_API_KEY in .env. Meanwhile, bookmark sources manually below; every toggle is stored.",
    );
  }

  const notes = new Map(selections.map((s) => [s.id, s.note]));

  await prisma.$transaction(
    project.resources.map((resource) =>
      prisma.resource.update({
        where: { id: resource.id },
        data: {
          selected: notes.has(resource.id),
          selectionNote: notes.get(resource.id) ?? "",
        },
      }),
    ),
  );

  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    message:
      selections.length > 0
        ? `Selected ${selections.length} of ${project.resources.length} indexed sources.`
        : "The model selected nothing — the index may not cover this brief yet.",
  };
}
