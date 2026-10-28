import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { NewProjectButton } from "@/components/new-project-button";
import { ProjectStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, padCount } from "@/lib/format";
import { listProjectSummaries } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjectSummaries();
  const activeCount = projects.filter(
    (project) => project.status === "active",
  ).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-7">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.22em] text-primary">
            Index 01 / active builds
          </p>
          <h1 className="mt-2 text-4xl font-medium text-foreground md:text-5xl">
            Projects
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The working record for every part, artifact, and decision.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="numeric hidden border-l border-primary pl-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
            {padCount(activeCount)} active / {padCount(projects.length)} total
          </span>
          <NewProjectButton />
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={FolderKanban}
          title="No projects in the index"
          description="Run the demo seed to create the Water Tank Monitor project, or wait for the project creation flow in the next milestone."
        />
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Card className="h-full gap-0 border border-border bg-card/80 py-0 shadow-[4px_4px_0_color-mix(in_srgb,var(--primary)_18%,transparent)] ring-0 transition-transform group-hover:-translate-y-1 group-hover:border-primary/60">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <ProjectStatusBadge status={project.status} />
                    <span className="numeric text-[10px] text-muted-foreground">
                      updated {formatDate(project.updatedAt)}
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-medium text-foreground transition-colors group-hover:text-primary">
                    {project.name}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {project.brief}
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">
                    <Stat
                      label="Requirements"
                      value={project.counts.requirements}
                    />
                    <Stat label="Components" value={project.counts.components} />
                    <Stat label="Artifacts" value={project.counts.artifacts} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="numeric text-lg leading-none text-foreground">
        {padCount(value)}
      </p>
      <p className="numeric mt-1.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
