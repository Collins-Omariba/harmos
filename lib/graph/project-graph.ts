import type { ProjectGraph } from "@/lib/graph/ripple";
import { prisma } from "@/lib/db";

export async function loadProjectGraph(projectId: string): Promise<{
  project: { id: string; name: string; brief: string };
  graph: ProjectGraph;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      components: { orderBy: { partNumber: "asc" } },
      artifacts: { orderBy: { name: "asc" } },
      edges: { orderBy: { id: "asc" } },
      componentLinks: { orderBy: { id: "asc" } },
    },
  });

  if (!project) {
    return null;
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      brief: project.brief,
    },
    graph: {
      nodes: [
        ...project.components.map((component) => ({
          type: "component" as const,
          id: component.id,
          label: component.partNumber,
          detail: `${component.manufacturer} · ${component.package}`,
          kind: "component",
        })),
        ...project.artifacts.map((artifact) => ({
          type: "artifact" as const,
          id: artifact.id,
          label: artifact.name,
          detail: `${artifact.kind} · ${artifact.version}${artifact.current ? " · current" : ""}`,
          kind: artifact.kind,
        })),
      ],
      edges: [
        ...project.componentLinks.map((link) => ({
          id: link.id,
          from: { type: "component" as const, id: link.componentId },
          to: { type: "artifact" as const, id: link.artifactId },
          kind: link.kind,
          source: "component-link" as const,
        })),
        ...project.edges.map((edge) => ({
          id: edge.id,
          from: { type: "artifact" as const, id: edge.fromArtifactId },
          to: { type: "artifact" as const, id: edge.toArtifactId },
          kind: edge.kind,
          source: "artifact-edge" as const,
        })),
      ],
    },
  };
}
