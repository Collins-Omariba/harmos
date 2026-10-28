import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  FlaskConical,
  GitBranch,
  Network,
  Search,
} from "lucide-react";

import { ArtifactRow } from "@/components/artifact-row";
import { ComparisonTab } from "@/components/comparison-tab";
import { ComponentTable } from "@/components/component-table";
import { EmptyState } from "@/components/empty-state";
import { RequirementCard } from "@/components/requirement-card";
import { ProjectStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATALOG_CATEGORIES } from "@/lib/catalog/types";
import { catalog } from "@/lib/catalog";
import { toDomainConstraint } from "@/lib/comparison/constraints";
import { prisma } from "@/lib/db";
import { formatDate, padCount } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      requirements: { orderBy: { id: "asc" } },
      components: { orderBy: { partNumber: "asc" } },
      artifacts: { orderBy: { name: "asc" } },
      edges: { orderBy: { id: "asc" } },
      decisions: { orderBy: { decidedAt: "desc" } },
      validationTests: { orderBy: { name: "asc" } },
      comparisonConstraints: { orderBy: { position: "asc" } },
      comparisonRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { candidates: { orderBy: { score: "desc" } } },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const catalogParts = await catalog.listParts();

  const artifactNames = new Map(
    project.artifacts.map((artifact) => [artifact.id, artifact.name]),
  );
  const counts = {
    requirements: project.requirements.length,
    components: project.components.length,
    artifacts: project.artifacts.length,
    edges: project.edges.length,
    decisions: project.decisions.length,
  };
  const comparisonConstraints = project.comparisonConstraints.map(
    toDomainConstraint,
  );
  const latestComparison = project.comparisonRuns[0] ?? null;
  const comparisonCandidateCount = latestComparison?.candidates.length ?? 0;
  const tabValues = [
    "overview",
    "components",
    "artifacts",
    "decisions",
    "research",
    "comparison",
    "graph",
  ];
  const defaultTab =
    tab && tabValues.includes(tab) ? tab : "overview";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 lg:py-10">
      <nav
        aria-label="Breadcrumb"
        className="numeric flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        <Link href="/" className="transition-colors hover:text-foreground">
          Projects
        </Link>
        <span className="text-border">/</span>
        <span className="truncate text-foreground/70">{project.name}</span>
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                {project.name}
              </h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              {project.brief}
            </p>
          </div>
          <div className="numeric shrink-0 text-right text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <p>Seeded {formatDate(project.createdAt)}</p>
            <p className="mt-1">Updated {formatDate(project.updatedAt)}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5 [&>div:last-child]:col-span-2 sm:[&>div:last-child]:col-span-1">
          <Stat label="Requirements" value={counts.requirements} />
          <Stat label="Components" value={counts.components} />
          <Stat label="Artifacts" value={counts.artifacts} />
          <Stat label="Edges" value={counts.edges} />
          <Stat label="Decisions" value={counts.decisions} />
        </dl>
      </header>

      <Tabs defaultValue={defaultTab} className="mt-7">
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto border-b border-border pb-1"
        >
          <TabsTrigger value="overview" className="flex-none px-3">
            Overview
          </TabsTrigger>
          <TabsTrigger value="components" className="flex-none px-3">
            Components
            <Count value={counts.components} />
          </TabsTrigger>
          <TabsTrigger value="artifacts" className="flex-none px-3">
            Artifacts
            <Count value={counts.artifacts} />
          </TabsTrigger>
          <TabsTrigger value="decisions" className="flex-none px-3">
            Decisions
            <Count value={counts.decisions} />
          </TabsTrigger>
          <TabsTrigger value="research" className="flex-none px-3">
            Research
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex-none px-3">
            Comparison
            <Count value={comparisonCandidateCount} />
          </TabsTrigger>
          <TabsTrigger value="graph" className="flex-none px-3">
            Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
            <Card className="gap-0 border border-border bg-card/70 py-0 shadow-none ring-0">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <SectionLabel>Brief</SectionLabel>
                  <span className="numeric text-[10px] text-muted-foreground">
                    {project.id}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-foreground/90">
                  {project.brief}
                </p>
              </CardContent>
            </Card>

            <Card className="gap-0 border border-border bg-card/70 py-0 shadow-none ring-0">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <SectionLabel>Validation</SectionLabel>
                  <FlaskConical className="size-3.5 text-accent" />
                </div>
                {project.validationTests.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {project.validationTests.map((test) => (
                      <div key={test.id}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {test.name}
                          </p>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-accent/35 bg-accent/10 font-mono text-[10px] uppercase tracking-[0.12em] text-accent"
                          >
                            {test.status}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {test.notes}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No validation tests recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <SectionLabel>Requirements</SectionLabel>
                <h2 className="mt-1.5 text-base font-medium text-foreground">
                  Constraint ledger
                </h2>
              </div>
              <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {padCount(counts.requirements)} cards
              </span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {project.requirements.map((requirement, index) => (
                <RequirementCard
                  key={requirement.id}
                  requirement={requirement}
                  index={index}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="components" className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <SectionLabel>Components</SectionLabel>
              <h2 className="mt-1.5 text-base font-medium text-foreground">
                Selected parts
              </h2>
            </div>
            <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {padCount(counts.components)} parts · fictional demo
            </span>
          </div>
          <ComponentTable components={project.components} />
        </TabsContent>

        <TabsContent value="artifacts" className="mt-6 space-y-8">
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <SectionLabel>Artifacts</SectionLabel>
                <h2 className="mt-1.5 text-base font-medium text-foreground">
                  Project files
                </h2>
              </div>
              <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {padCount(counts.artifacts)} artifacts
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {project.artifacts.map((artifact) => (
                <ArtifactRow key={artifact.id} artifact={artifact} />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <SectionLabel>Artifact links</SectionLabel>
                <h2 className="mt-1.5 text-base font-medium text-foreground">
                  Recorded edges
                </h2>
              </div>
              <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {padCount(counts.edges)} edges
              </span>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {project.edges.map((edge) => (
                <div
                  key={edge.id}
                  className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                >
                  <span className="truncate text-foreground">
                    {artifactNames.get(edge.fromArtifactId) ??
                      edge.fromArtifactId}
                  </span>
                  <Badge
                    variant="outline"
                    className="numeric border-accent/30 bg-accent/5 text-[10px] text-accent"
                  >
                    {edge.kind}
                  </Badge>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="truncate text-foreground">
                    {artifactNames.get(edge.toArtifactId) ?? edge.toArtifactId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="decisions" className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <SectionLabel>Decisions</SectionLabel>
              <h2 className="mt-1.5 text-base font-medium text-foreground">
                Decision log
              </h2>
            </div>
            <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {padCount(counts.decisions)} records
            </span>
          </div>

          {project.decisions.length > 0 ? (
            <div className="space-y-3">
              {project.decisions.map((decision) => (
                <Card
                  key={decision.id}
                  className="gap-0 rounded-l-none border border-l-2 border-border border-l-accent bg-card/70 py-0 shadow-none ring-0"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-sm font-medium text-foreground">
                        {decision.title}
                      </h3>
                      <span className="numeric shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {formatDate(decision.decidedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {decision.rationale}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={GitBranch}
              title="No decisions recorded"
              description="Design decisions and their rationale will be logged here as the project evolves."
            />
          )}
        </TabsContent>

        <TabsContent value="research" className="mt-6">
          <EmptyState
            icon={Search}
            title="Research index not built yet"
            description="M3 will index sources, retrieve datasheets, and let select_resources() pick from a pre-indexed local list. No live web search."
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-6">
          <ComparisonTab
            projectId={project.id}
            constraints={comparisonConstraints}
            run={latestComparison}
            catalogParts={catalogParts}
            categories={CATALOG_CATEGORIES.map((category) => ({
              key: category.key,
              label: category.label,
              description: category.description,
            }))}
          />
        </TabsContent>

        <TabsContent value="graph" className="mt-6">
          <EmptyState
            icon={Network}
            title="Dependency graph not built yet"
            description={`${padCount(counts.edges)} edges are already recorded. The interactive artifact graph and change-impact preview land in M4.`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-3 py-3">
      <dt className="numeric text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="numeric mt-1 text-lg leading-none text-foreground">
        {padCount(value)}
      </dd>
    </div>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span className="numeric text-[10px] text-muted-foreground">
      {padCount(value)}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}
