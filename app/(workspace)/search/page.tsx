import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { catalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

function includes(value: string | null | undefined, needle: string): boolean {
  return Boolean(value?.toLowerCase().includes(needle));
}

function snippet(value: string, needle: string): string {
  const index = value.toLowerCase().indexOf(needle);
  if (index < 0) return value.slice(0, 140);
  const start = Math.max(0, index - 45);
  const end = Math.min(value.length, index + needle.length + 75);
  return `${start > 0 ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const needle = query.toLowerCase();

  const projects = query
    ? await prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          requirements: true,
          components: true,
          artifacts: true,
          decisions: true,
          resources: true,
        },
      })
    : [];
  const catalogParts = query
    ? await catalog.listParts({ search: query })
    : [];

  const projectResults = projects
    .map((project) => {
      const matches: { label: string; text: string; href: string }[] = [];
      if (includes(project.name, needle) || includes(project.brief, needle)) {
        matches.push({
          label: "Project",
          text: snippet(`${project.name} — ${project.brief}`, needle),
          href: `/projects/${project.id}`,
        });
      }
      for (const requirement of project.requirements) {
        if (includes(requirement.text, needle)) {
          matches.push({
            label: "Requirement",
            text: snippet(requirement.text, needle),
            href: `/projects/${project.id}?tab=overview`,
          });
        }
      }
      for (const component of project.components) {
        if (
          includes(component.partNumber, needle) ||
          includes(component.manufacturer, needle) ||
          includes(component.notes, needle)
        ) {
          matches.push({
            label: "Component",
            text: `${component.partNumber} · ${component.manufacturer}`,
            href: `/projects/${project.id}?tab=components`,
          });
        }
      }
      for (const artifact of project.artifacts) {
        if (
          includes(artifact.name, needle) ||
          includes(artifact.version, needle) ||
          includes(artifact.metaJson, needle)
        ) {
          matches.push({
            label: "Artifact",
            text: `${artifact.name} · ${artifact.version}`,
            href: `/projects/${project.id}?tab=artifacts`,
          });
        }
      }
      for (const decision of project.decisions) {
        if (includes(decision.title, needle) || includes(decision.rationale, needle)) {
          matches.push({
            label: "Decision",
            text: snippet(`${decision.title} — ${decision.rationale}`, needle),
            href: `/projects/${project.id}?tab=decisions`,
          });
        }
      }
      for (const resource of project.resources) {
        if (includes(resource.title, needle) || includes(resource.summary, needle)) {
          matches.push({
            label: "Resource",
            text: snippet(`${resource.title} — ${resource.summary}`, needle),
            href: `/projects/${project.id}?tab=research`,
          });
        }
      }
      return { project, matches: matches.slice(0, 8) };
    })
    .filter((result) => result.matches.length > 0);

  const totalMatches =
    projectResults.reduce((sum, result) => sum + result.matches.length, 0) +
    catalogParts.length;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 lg:py-10">
      <p className="numeric text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Workspace / search
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        Search everything
      </h1>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Projects, requirements, components, artifacts, decisions, resources,
        and the global catalog.
      </p>

      <form className="mt-6 flex max-w-2xl items-center gap-2" action="/search">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search part numbers, decisions, requirements..."
            aria-label="Search workspace"
            className="h-11 w-full rounded-full border border-input bg-background pr-4 pl-10 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      {query ? (
        <p className="numeric mt-5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {totalMatches} result{totalMatches === 1 ? "" : "s"} for “{query}”
        </p>
      ) : null}

      {query && totalMatches === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <h2 className="text-sm font-medium text-foreground">No matches</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a part number, manufacturer, or a word from a decision.
          </p>
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        {projectResults.map(({ project, matches }) => (
          <section key={project.id}>
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/projects/${project.id}`}
                className="text-base font-medium text-foreground hover:text-primary"
              >
                {project.name}
              </Link>
              <Badge variant="outline" className="numeric border-border bg-muted/40 text-[10px] text-muted-foreground">
                {project.status}
              </Badge>
            </div>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {matches.map((match, index) => (
                <Link
                  key={`${match.label}-${index}`}
                  href={match.href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <Badge variant="outline" className="numeric mt-0.5 shrink-0 border-primary/30 bg-primary/5 text-[9px] text-primary">
                    {match.label}
                  </Badge>
                  <span className="min-w-0 text-sm leading-relaxed text-muted-foreground">
                    {match.text}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {catalogParts.length > 0 ? (
          <section>
            <Link href="/catalog" className="text-base font-medium text-foreground hover:text-primary">
              Catalog
            </Link>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {catalogParts.slice(0, 12).map((part) => (
                <Link
                  key={part.id}
                  href="/catalog"
                  className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="numeric block text-sm font-medium text-foreground">{part.partNumber}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {part.manufacturer} · {part.description}
                    </span>
                  </span>
                  <span className="numeric shrink-0 text-xs text-muted-foreground">
                    {part.priceUsd !== null ? `$${part.priceUsd.toFixed(2)}` : "no price"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
