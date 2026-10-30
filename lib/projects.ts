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

/**
 * Projects a user may see: their own plus shared (ownerless) rows such as
 * the seed demo. Never returns another user's projects.
 */
export function accessibleProjectFilter(userId: string) {
  return { OR: [{ ownerId: userId }, { ownerId: null }] };
}

export async function listProjectSummaries(
  userId: string,
): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: accessibleProjectFilter(userId),
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
