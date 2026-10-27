import { prisma } from "@/lib/db";

export type ProjectNavItem = {
  id: string;
  name: string;
  status: string;
};

export type ProjectSummary = ProjectNavItem & {
  brief: string;
  updatedAt: string;
  counts: {
    requirements: number;
    components: number;
    artifacts: number;
  };
};

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          requirements: true,
          components: true,
          artifacts: true,
        },
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    brief: project.brief,
    updatedAt: project.updatedAt.toISOString(),
    counts: {
      requirements: project._count.requirements,
      components: project._count.components,
      artifacts: project._count.artifacts,
    },
  }));
}
