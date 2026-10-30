export type GraphNodeType = "component" | "artifact";

export type GraphNodeRef = {
  type: GraphNodeType;
  id: string;
};

export type GraphNode = GraphNodeRef & {
  label: string;
  detail: string;
  kind: string;
};

export type GraphEdge = {
  id: string;
  from: GraphNodeRef;
  to: GraphNodeRef;
  kind: string;
  source: "artifact-edge" | "component-link";
};

export type ProjectGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type RippleStep = {
  node: GraphNode;
  /** Shortest dependency depth from the changed node. */
  depth: number;
  /** Node labels from the changed node to this node, inclusive. */
  path: string[];
  /** Edge kinds traversed along that shortest path. */
  via: string[];
};

export type RippleResult = {
  start: GraphNode;
  affected: RippleStep[];
  affectedIds: string[];
};

export function nodeKey(node: GraphNodeRef): string {
  return `${node.type}:${node.id}`;
}

export function sameNode(a: GraphNodeRef, b: GraphNodeRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/**
 * Deterministic downstream ripple. Edges point from a dependency to the work
 * that depends on it, so changing a schematic reaches firmware through
 * schematic -> firmware. Breadth-first traversal gives stable ordering,
 * shortest paths, and cycle safety: each node is reported once, at its
 * shallowest depth, regardless of how many routes or loops reach it.
 */
export function computeRipple(
  graph: ProjectGraph,
  startRef: GraphNodeRef,
): RippleResult | null {
  const nodesByKey = new Map(graph.nodes.map((node) => [nodeKey(node), node]));
  const start = nodesByKey.get(nodeKey(startRef));

  if (!start) {
    return null;
  }

  const adjacency = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    // Ignore edges that reference nodes outside this graph snapshot.
    if (!nodesByKey.has(nodeKey(edge.from)) || !nodesByKey.has(nodeKey(edge.to))) {
      continue;
    }
    const key = nodeKey(edge.from);
    const existing = adjacency.get(key) ?? [];
    existing.push(edge);
    adjacency.set(key, existing);
  }
  for (const edges of adjacency.values()) {
    edges.sort((a, b) => {
      const aNode = nodesByKey.get(nodeKey(a.to));
      const bNode = nodesByKey.get(nodeKey(b.to));
      return (
        (aNode?.label ?? a.to.id).localeCompare(bNode?.label ?? b.to.id) ||
        a.kind.localeCompare(b.kind) ||
        a.id.localeCompare(b.id)
      );
    });
  }

  type Visit = {
    node: GraphNode;
    depth: number;
    path: string[];
    via: string[];
  };

  const visited = new Map<string, Visit>();
  const startVisit: Visit = {
    node: start,
    depth: 0,
    path: [start.label],
    via: [],
  };
  visited.set(nodeKey(start), startVisit);

  const queue: Visit[] = [startVisit];
  const affected: RippleStep[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const edge of adjacency.get(nodeKey(current.node)) ?? []) {
      const next = nodesByKey.get(nodeKey(edge.to));
      if (!next || visited.has(nodeKey(next))) {
        continue;
      }

      const visit: Visit = {
        node: next,
        depth: current.depth + 1,
        path: [...current.path, next.label],
        via: [...current.via, edge.kind],
      };
      visited.set(nodeKey(next), visit);
      queue.push(visit);
      affected.push({
        node: next,
        depth: visit.depth,
        path: visit.path,
        via: visit.via,
      });
    }
  }

  affected.sort(
    (a, b) =>
      a.depth - b.depth ||
      a.node.label.localeCompare(b.node.label) ||
      a.node.id.localeCompare(b.node.id),
  );

  return {
    start,
    affected,
    affectedIds: affected.map((step) => step.node.id),
  };
}

export function deterministicImpactSummary(result: RippleResult): string {
  if (result.affected.length === 0) {
    return `Changing ${result.start.label} has no recorded downstream impact. Add component links or artifact edges if this part feeds other work.`;
  }

  const direct = result.affected
    .filter((step) => step.depth === 1)
    .map((step) => step.node.label);
  const downstream = result.affected.length - direct.length;

  return [
    `Changing ${result.start.label} directly affects ${direct.join(", ")}.`,
    downstream > 0
      ? `${downstream} further item${downstream === 1 ? "" : "s"} sit downstream and should be rechecked after the direct items.`
      : "Nothing else sits downstream in the recorded graph.",
  ].join(" ");
}
