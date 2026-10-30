import { z } from "zod";

const recordSchema = z.record(z.string(), z.unknown());
const rowsSchema = z.array(recordSchema).default([]);

export const projectExportSchema = z.object({
  format: z.literal("harmos-project-export"),
  version: z.literal(1),
  exportedAt: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string().min(1),
    brief: z.string(),
    status: z.string(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
  requirements: rowsSchema,
  comparisonConstraints: rowsSchema,
  components: rowsSchema,
  artifacts: rowsSchema,
  edges: rowsSchema,
  componentLinks: rowsSchema,
  decisions: rowsSchema,
  validationTests: rowsSchema,
  resources: rowsSchema,
  comparisonRuns: rowsSchema,
  comparisonCandidates: rowsSchema,
});

export type ProjectExport = z.infer<typeof projectExportSchema>;

type Row = Record<string, unknown>;

function remapRows(
  rows: Row[],
  projectId: string,
  idMap: Map<string, string>,
  makeId: (oldId: string) => string,
  extra: (row: Row) => Row = (row) => row,
): Row[] {
  return rows.map((row) => {
    const oldId = String(row.id ?? "");
    const next: Row = {
      ...row,
      ...extra(row),
      projectId,
    };
    if (oldId) {
      next.id = idMap.get(oldId) ?? makeId(oldId);
    }
    return next;
  });
}

function mapFor(rows: Row[], makeId: (oldId: string) => string): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const oldId = String(row.id ?? "");
    if (oldId && !map.has(oldId)) map.set(oldId, makeId(oldId));
  }
  return map;
}

function remapRef(
  value: unknown,
  map: Map<string, string>,
): string | null {
  if (typeof value !== "string") return null;
  return map.get(value) ?? null;
}

/**
 * Rewrites an exported project for import under a fresh project id. Every
 * internal reference (artifact edges, component links, comparison runs and
 * candidates) is remapped consistently; catalog part references are kept
 * because the catalog is global.
 */
export function buildProjectImportPlan(
  raw: unknown,
  newProjectId: string,
  makeId: (oldId: string) => string = (oldId) => `imported-${oldId}`,
) {
  const data = projectExportSchema.parse(raw);
  const componentIds = mapFor(data.components, makeId);
  const artifactIds = mapFor(data.artifacts, makeId);
  const runIds = mapFor(data.comparisonRuns, makeId);

  const project = {
    id: newProjectId,
    name: data.project.name,
    brief: data.project.brief,
    status: data.project.status,
  };

  const artifacts = remapRows(data.artifacts, newProjectId, artifactIds, makeId, (row) => {
    const { edgesFrom: _a, edgesTo: _b, componentLinks: _c, ...rest } = row;
    void _a; void _b; void _c;
    return rest;
  });
  const components = remapRows(data.components, newProjectId, componentIds, makeId, (row) => {
    const { artifactLinks: _a, ...rest } = row;
    void _a;
    return rest;
  });

  return {
    project,
    requirements: remapRows(data.requirements, newProjectId, new Map(), makeId),
    comparisonConstraints: remapRows(
      data.comparisonConstraints,
      newProjectId,
      new Map(),
      makeId,
    ),
    components,
    artifacts,
    edges: remapRows(data.edges, newProjectId, new Map(), makeId, (row) => ({
      fromArtifactId: remapRef(row.fromArtifactId, artifactIds),
      toArtifactId: remapRef(row.toArtifactId, artifactIds),
    })).filter((row) => row.fromArtifactId && row.toArtifactId),
    componentLinks: remapRows(
      data.componentLinks,
      newProjectId,
      new Map(),
      makeId,
      (row) => ({
        componentId: remapRef(row.componentId, componentIds),
        artifactId: remapRef(row.artifactId, artifactIds),
      }),
    ).filter((row) => row.componentId && row.artifactId),
    decisions: remapRows(data.decisions, newProjectId, new Map(), makeId),
    validationTests: remapRows(data.validationTests, newProjectId, new Map(), makeId),
    resources: remapRows(data.resources, newProjectId, new Map(), makeId),
    comparisonRuns: remapRows(data.comparisonRuns, newProjectId, runIds, makeId, (row) => {
      const { candidates: _candidates, ...rest } = row;
      void _candidates;
      return rest;
    }),
    comparisonCandidates: remapRows(
      data.comparisonCandidates,
      newProjectId,
      new Map(),
      makeId,
      (row) => ({ runId: remapRef(row.runId, runIds) }),
    ),
  };
}

export type ProjectImportPlan = ReturnType<typeof buildProjectImportPlan>;
