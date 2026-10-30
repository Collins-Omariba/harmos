"use server";

import {
  answerLoadedQuestion,
  candidateSummaries,
  type AssistantAnswer,
  type ProjectSnapshot,
} from "@/lib/assistant/answer";
import { routeQuestion } from "@/lib/assistant/router";
import { decodeConstraintValue } from "@/lib/comparison/constraints";
import { catalog } from "@/lib/catalog";
import { searchCatalog } from "@/lib/catalog/intelligence";
import { prisma } from "@/lib/db";

export type AskResult = AssistantAnswer;

export async function askAssistantAction(input: {
  projectId: string | null;
  question: string;
}): Promise<AskResult> {
  const question = (input.question ?? "").trim();

  if (question.length < 2) {
    return {
      text: "Ask me about a project's costs, comparisons, versions, requirements, sources, tests, or decisions.",
      citations: [],
      followUps: ["What does the BOM total?", "What passed the comparison?"],
      source: "computed",
    };
  }

  if (!input.projectId) {
    return answerAcrossProjects(question);
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: {
      requirements: { orderBy: { id: "asc" } },
      comparisonConstraints: { orderBy: { position: "asc" } },
      comparisonRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { candidates: { orderBy: { score: "desc" } } },
      },
      components: { orderBy: { partNumber: "asc" } },
      artifacts: { orderBy: { name: "asc" } },
      decisions: { orderBy: { decidedAt: "desc" } },
      validationTests: { orderBy: { name: "asc" } },
      resources: { orderBy: { title: "asc" } },
    },
  });

  if (!project) {
    return {
      text: "I could not find that project. Pick one from the project index.",
      citations: [],
      followUps: [],
      source: "computed",
    };
  }

  const latestRun = project.comparisonRuns[0] ?? null;
  const catalogParts = await catalog.listParts();
  const catalogSearch = searchCatalog(catalogParts, question, 8);
  const routed = routeQuestion(question, [
    ...project.components.map((c) => c.partNumber),
    ...catalogParts.map((part) => part.partNumber),
  ]);
  const catalogMatches =
    routed.intent === "catalog" || routed.mentions.length > 0
      ? catalogSearch.parts.map((part) => ({
          partNumber: part.partNumber,
          manufacturer: part.manufacturer,
          category: part.category,
          priceUsd: part.priceUsd,
          description: part.description,
        }))
      : [];
  const categoryByPartNumber = new Map(
    catalogParts.map((part) => [part.partNumber, part.category]),
  );
  const snapshot: ProjectSnapshot = {
    id: project.id,
    name: project.name,
    brief: project.brief,
    status: project.status,
    requirements: project.requirements.map((r) => ({
      text: r.text,
      kind: r.kind,
      status: r.status,
    })),
    constraints: project.comparisonConstraints.map((c) => ({
      label: c.label,
      metric: c.metric,
      operator: c.operator,
      value: decodeConstraintValue(c.valueJson),
      unit: c.unit,
      kind: c.kind,
    })),
    latestRun: latestRun
      ? {
          category: latestRun.category,
          summary: latestRun.summary,
          explanationStatus: latestRun.explanationStatus,
          candidates: candidateSummaries(latestRun.candidates),
        }
      : null,
    components: project.components.map((c) => ({
      id: c.id,
      partNumber: c.partNumber,
      manufacturer: c.manufacturer,
      category: categoryByPartNumber.get(c.partNumber) ?? null,
      quantity: c.quantity,
      unitPriceCents: c.unitPriceCents,
    })),
    currentArtifacts: project.artifacts
      .filter((a) => a.current)
      .map((a) => ({ kind: a.kind, name: a.name, version: a.version })),
    decisions: project.decisions.map((d) => ({ title: d.title })),
    validationTests: project.validationTests.map((t) => ({
      name: t.name,
      status: t.status,
    })),
    selectedResources: project.resources
      .filter((r) => r.selected)
      .map((r) => ({ title: r.title, url: r.url, note: r.selectionNote })),
    resourceIndexSize: project.resources.length,
    catalogMatches,
  };

  const knownTerms = [
    ...project.components.map((c) => c.partNumber),
    ...project.artifacts.map((a) => a.name),
    ...catalogParts.map((part) => part.partNumber),
  ];

  return answerLoadedQuestion(snapshot, question, knownTerms);
}

async function answerAcrossProjects(question: string): Promise<AskResult> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          requirements: true,
          components: true,
          comparisonRuns: true,
        },
      },
    },
  });

  if (projects.length === 0) {
    return {
      text: "No projects yet. Create one from the sidebar to get started.",
      citations: [],
      followUps: [],
      source: "computed",
    };
  }

  const lowered = question.toLowerCase();
  if (
    /project/.test(lowered) ||
    /which|list|how many|status|overview|summary/.test(lowered)
  ) {
    return {
      text:
        `${projects.length} project${projects.length === 1 ? "" : "s"}: ` +
        projects
          .map(
            (p) =>
              `${p.name} (${p.status}, ${p._count.requirements} requirements, ${p._count.components} components, ${p._count.comparisonRuns} comparison runs)`,
          )
          .join("; ") +
        ". Ask me about one project at a time for costs, comparisons, and versions.",
      citations: projects.map((p) => ({
        label: p.name,
        href: `/projects/${p.id}`,
      })),
      followUps: ["What does the BOM total?", "What passed the comparison?"],
      source: "computed",
    };
  }

  return {
    text: `I answer from one project's data at a time. Pick one: ${projects.map((p) => p.name).join(", ")}.`,
    citations: projects.map((p) => ({
      label: p.name,
      href: `/projects/${p.id}`,
    })),
    followUps: [],
    source: "computed",
  };
}
