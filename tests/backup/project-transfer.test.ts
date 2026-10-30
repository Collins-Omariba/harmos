import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectImportPlan } from "@/lib/backup/project-transfer";

test("project import remaps every internal reference consistently", () => {
  const plan = buildProjectImportPlan(
    {
      format: "harmos-project-export",
      version: 1,
      exportedAt: "2026-10-30T00:00:00.000Z",
      project: { id: "old-project", name: "Demo", brief: "Brief", status: "draft" },
      requirements: [{ id: "req-1", text: "Must work" }],
      comparisonConstraints: [],
      components: [{ id: "comp-1", partNumber: "A-1" }],
      artifacts: [
        { id: "art-1", name: "Board" },
        { id: "art-2", name: "Firmware" },
      ],
      edges: [{ id: "edge-1", fromArtifactId: "art-1", toArtifactId: "art-2" }],
      componentLinks: [
        { id: "link-1", componentId: "comp-1", artifactId: "art-1" },
      ],
      decisions: [],
      validationTests: [],
      resources: [],
      comparisonRuns: [{ id: "run-1", category: "ldo" }],
      comparisonCandidates: [{ id: "cand-1", runId: "run-1", partNumber: "A-1" }],
    },
    "proj-new",
    (oldId) => `new-${oldId}`,
  );

  assert.equal(plan.project.id, "proj-new");
  assert.equal(plan.edges[0]?.fromArtifactId, "new-art-1");
  assert.equal(plan.edges[0]?.toArtifactId, "new-art-2");
  assert.equal(plan.componentLinks[0]?.componentId, "new-comp-1");
  assert.equal(plan.comparisonCandidates[0]?.runId, "new-run-1");
  assert.ok(plan.components.every((row) => row.projectId === "proj-new"));
});

test("foreign project files are rejected", () => {
  assert.throws(
    () => buildProjectImportPlan({ format: "something-else" }, "proj-new"),
    /harmos-project-export|Invalid/,
  );
});
