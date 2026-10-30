import assert from "node:assert/strict";
import test from "node:test";

import {
  computeRipple,
  deterministicImpactSummary,
  type GraphEdge,
  type GraphNode,
  type ProjectGraph,
} from "@/lib/graph/ripple";

function node(id: string, type: "component" | "artifact" = "artifact"): GraphNode {
  return {
    type,
    id,
    label: id.toUpperCase(),
    detail: `${type} ${id}`,
    kind: type,
  };
}

function edge(from: GraphNode, to: GraphNode, kind = "informs"): GraphEdge {
  return {
    id: `${from.id}-${to.id}-${kind}`,
    from: { type: from.type, id: from.id },
    to: { type: to.type, id: to.id },
    kind,
    source: from.type === "component" ? "component-link" : "artifact-edge",
  };
}

test("component swaps ripple through direct and downstream artifacts", () => {
  const mcu = node("mcu", "component");
  const board = node("board");
  const firmware = node("firmware");
  const graph: ProjectGraph = {
    nodes: [mcu, board, firmware],
    edges: [edge(mcu, board, "feeds"), edge(board, firmware)],
  };

  const result = computeRipple(graph, mcu);

  assert.ok(result);
  assert.deepEqual(result.affectedIds, ["board", "firmware"]);
  assert.deepEqual(
    result.affected.map((step) => [step.depth, step.path]),
    [
      [1, ["MCU", "BOARD"]],
      [2, ["MCU", "BOARD", "FIRMWARE"]],
    ],
  );
});

test("fan-out reports every branch once in deterministic order", () => {
  const start = node("start", "component");
  const zeta = node("zeta");
  const alpha = node("alpha");
  const shared = node("shared");
  const graph: ProjectGraph = {
    nodes: [start, zeta, alpha, shared],
    edges: [
      edge(start, zeta),
      edge(start, alpha),
      edge(zeta, shared),
      edge(alpha, shared),
    ],
  };

  const result = computeRipple(graph, start);

  assert.ok(result);
  assert.deepEqual(result.affectedIds, ["alpha", "zeta", "shared"]);
  assert.equal(result.affected.find((step) => step.node.id === "shared")?.depth, 2);
});

test("cycles terminate and never report the changed node as affected", () => {
  const a = node("a");
  const b = node("b");
  const c = node("c");
  const graph: ProjectGraph = {
    nodes: [a, b, c],
    edges: [edge(a, b), edge(b, c), edge(c, a), edge(c, b)],
  };

  const result = computeRipple(graph, a);

  assert.ok(result);
  assert.deepEqual(result.affectedIds, ["b", "c"]);
  assert.equal(result.affected.some((step) => step.node.id === "a"), false);
});

test("missing starts and empty graphs return no fabricated impact", () => {
  const a = node("a");
  assert.equal(computeRipple({ nodes: [a], edges: [] }, node("missing")), null);

  const result = computeRipple({ nodes: [a], edges: [] }, a);
  assert.ok(result);
  assert.deepEqual(result.affected, []);
  assert.match(deterministicImpactSummary(result), /no recorded downstream impact/);
});

test("edges pointing outside the snapshot are ignored", () => {
  const start = node("start", "component");
  const board = node("board");
  const graph: ProjectGraph = {
    nodes: [start, board],
    edges: [
      edge(start, board),
      {
        id: "ghost",
        from: { type: "artifact", id: "ghost" },
        to: { type: "artifact", id: "board" },
        kind: "informs",
        source: "artifact-edge",
      },
    ],
  };

  const result = computeRipple(graph, start);
  assert.deepEqual(result?.affectedIds, ["board"]);
});
