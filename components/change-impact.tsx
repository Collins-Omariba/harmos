"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  GitBranch,
  Link2,
  Network,
  Repeat,
  Route,
  Trash2,
} from "lucide-react";

import {
  applyComponentSwapAction,
  createArtifactEdgeAction,
  createComponentLinkAction,
  deleteArtifactEdgeAction,
  deleteComponentLinkAction,
  previewComponentSwapAction,
  type GraphActionState,
  type ImpactPreviewResult,
} from "@/app/actions/graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CatalogPart } from "@/lib/catalog/types";
import {
  computeRipple,
  nodeKey,
  type GraphEdge,
  type GraphNode,
  type ProjectGraph,
} from "@/lib/graph/ripple";
import { cn } from "@/lib/utils";

type GraphAction = (
  previous: GraphActionState,
  formData: FormData,
) => Promise<GraphActionState>;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function columnFor(node: GraphNode): number {
  if (node.type === "component") return 105;
  if (node.kind === "datasheet") return 325;
  if (node.kind === "schematic" || node.kind === "pcb") return 535;
  return 745;
}

function DeleteGraphRecord({
  action,
  projectId,
  recordId,
  label,
}: {
  action: GraphAction;
  projectId: string;
  recordId: string;
  label: string;
}) {
  const [, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="recordId" value={recordId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        aria-label={label}
        disabled={pending}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </form>
  );
}

function ActionStateMessage({ state }: { state: GraphActionState }) {
  if (!state) return null;
  return (
    <p
      className={cn(
        "mt-3 rounded-md border px-3 py-2 text-xs",
        state.ok
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {state.message}
    </p>
  );
}

function ArtifactEdgeForm({
  projectId,
  artifacts,
}: {
  projectId: string;
  artifacts: GraphNode[];
}) {
  const [state, formAction, pending] = useActionState(
    createArtifactEdgeAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">From</span>
          <select name="fromArtifactId" required className={selectClass} defaultValue={artifacts[0]?.id}>
            {artifacts.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>{artifact.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Relationship</span>
          <select name="kind" className={selectClass} defaultValue="informs">
            {["informs", "documents", "depends_on", "uses", "tested_by", "generated_from"].map((kind) => (
              <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">To</span>
          <select name="toArtifactId" required className={selectClass} defaultValue={artifacts[1]?.id ?? artifacts[0]?.id}>
            {artifacts.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>{artifact.label}</option>
            ))}
          </select>
        </label>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending || artifacts.length < 2}>
        <GitBranch data-icon="inline-start" />
        Add artifact edge
      </Button>
      <ActionStateMessage state={state} />
    </form>
  );
}

function ComponentLinkForm({
  projectId,
  components,
  artifacts,
}: {
  projectId: string;
  components: GraphNode[];
  artifacts: GraphNode[];
}) {
  const [state, formAction, pending] = useActionState(
    createComponentLinkAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Component</span>
          <select name="componentId" required className={selectClass} defaultValue={components[0]?.id}>
            {components.map((component) => (
              <option key={component.id} value={component.id}>{component.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Relationship</span>
          <select name="kind" className={selectClass} defaultValue="feeds">
            {["feeds", "uses", "documents", "powers", "controls"].map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Artifact</span>
          <select name="artifactId" required className={selectClass} defaultValue={artifacts[0]?.id}>
            {artifacts.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>{artifact.label}</option>
            ))}
          </select>
        </label>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending || components.length === 0 || artifacts.length === 0}>
        <Link2 data-icon="inline-start" />
        Add component link
      </Button>
      <ActionStateMessage state={state} />
    </form>
  );
}

export function ChangeImpact({
  projectId,
  graph,
  catalogParts,
}: {
  projectId: string;
  graph: ProjectGraph;
  catalogParts: CatalogPart[];
}) {
  const router = useRouter();
  const firstComponent = graph.nodes.find((node) => node.type === "component");
  const firstNode = firstComponent ?? graph.nodes[0];
  const [selectedKey, setSelectedKey] = useState(firstNode ? nodeKey(firstNode) : "");
  const [replacementId, setReplacementId] = useState(catalogParts[0]?.id ?? "");
  const [preview, setPreview] = useState<ImpactPreviewResult | null>(null);
  const [applyMessage, setApplyMessage] = useState<GraphActionState>(null);
  const [previewPending, startPreview] = useTransition();
  const [applyPending, startApply] = useTransition();

  const selected = graph.nodes.find((node) => nodeKey(node) === selectedKey) ?? firstNode;
  const ripple = useMemo(
    () => (selected ? computeRipple(graph, selected) : null),
    [graph, selected],
  );
  const affectedKeys = useMemo(
    () => new Set(ripple?.affected.map((step) => nodeKey(step.node)) ?? []),
    [ripple],
  );

  const components = graph.nodes.filter((node) => node.type === "component");
  const artifacts = graph.nodes.filter((node) => node.type === "artifact");
  const replacement = catalogParts.find((part) => part.id === replacementId);
  const previewMatches =
    preview?.ok === true &&
    selected?.type === "component" &&
    preview.componentId === selected.id &&
    preview.catalogPartId === replacementId;

  const positions = useMemo(() => {
    const columns = new Map<number, GraphNode[]>();
    for (const node of graph.nodes) {
      const column = columnFor(node);
      const nodes = columns.get(column) ?? [];
      nodes.push(node);
      columns.set(column, nodes);
    }
    const map = new Map<string, { x: number; y: number }>();
    for (const [x, nodes] of columns) {
      nodes
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((node, index) => {
          map.set(nodeKey(node), { x, y: 62 + index * 76 });
        });
    }
    return map;
  }, [graph.nodes]);

  const maxRows = Math.max(
    1,
    ...[105, 325, 535, 745].map(
      (column) => graph.nodes.filter((node) => columnFor(node) === column).length,
    ),
  );
  const height = Math.max(430, 100 + maxRows * 76);

  function selectNode(node: GraphNode) {
    setSelectedKey(nodeKey(node));
    setPreview(null);
    setApplyMessage(null);
  }

  function runPreview() {
    if (!selected || selected.type !== "component" || !replacementId) return;
    setApplyMessage(null);
    startPreview(async () => {
      const result = await previewComponentSwapAction({
        projectId,
        componentId: selected.id,
        catalogPartId: replacementId,
      });
      setPreview(result);
    });
  }

  function runApply() {
    if (!previewMatches || !preview?.ok) return;
    startApply(async () => {
      const result = await applyComponentSwapAction({
        projectId,
        componentId: preview.componentId,
        catalogPartId: preview.catalogPartId,
      });
      setApplyMessage(result);
      if (result?.ok) {
        setPreview(null);
        router.refresh();
      }
    });
  }

  function edgePath(edge: GraphEdge): string {
    const from = positions.get(nodeKey(edge.from));
    const to = positions.get(nodeKey(edge.to));
    if (!from || !to) return "";
    const x1 = from.x + 84;
    const y1 = from.y;
    const x2 = to.x - 84;
    const y2 = to.y;
    const bend = Math.max(42, Math.abs(x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Dependency graph
          </p>
          <h2 className="mt-1.5 text-base font-medium text-foreground">
            Change-impact preview
          </h2>
        </div>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {graph.nodes.length} nodes · {graph.edges.length} links
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-border bg-card/70">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-accent" />
              <h3 className="text-sm font-medium text-foreground">Project graph</h3>
            </div>
            <span className="numeric text-[10px] text-muted-foreground">Click a node to inspect impact</span>
          </div>

          {graph.nodes.length > 0 ? (
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 900 ${height}`} className="min-w-[760px]" role="img" aria-label="Project dependency graph">
                <defs>
                  <marker id="impact-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground" />
                  </marker>
                  <marker id="impact-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" className="fill-primary" />
                  </marker>
                </defs>

                {graph.edges.map((edge) => {
                  const active =
                    selected &&
                    (nodeKey(edge.from) === nodeKey(selected) || affectedKeys.has(nodeKey(edge.from))) &&
                    affectedKeys.has(nodeKey(edge.to));
                  return (
                    <g key={edge.id}>
                      <path
                        d={edgePath(edge)}
                        fill="none"
                        markerEnd={active ? "url(#impact-arrow-active)" : "url(#impact-arrow)"}
                        className={cn(
                          active ? "stroke-primary" : "stroke-border",
                        )}
                        strokeWidth={active ? 2.4 : 1.4}
                      />
                      <text
                        x={((positions.get(nodeKey(edge.from))?.x ?? 0) + (positions.get(nodeKey(edge.to))?.x ?? 0)) / 2}
                        y={((positions.get(nodeKey(edge.from))?.y ?? 0) + (positions.get(nodeKey(edge.to))?.y ?? 0)) / 2 - 6}
                        textAnchor="middle"
                        className={cn(
                          "fill-muted-foreground text-[9px]",
                          active && "fill-primary",
                        )}
                      >
                        {edge.kind.replaceAll("_", " ")}
                      </text>
                    </g>
                  );
                })}

                {graph.nodes.map((node) => {
                  const position = positions.get(nodeKey(node));
                  if (!position) return null;
                  const isSelected = selected && nodeKey(node) === nodeKey(selected);
                  const isAffected = affectedKeys.has(nodeKey(node));
                  return (
                    <g
                      key={nodeKey(node)}
                      transform={`translate(${position.x - 84}, ${position.y - 27})`}
                      onClick={() => selectNode(node)}
                      className="cursor-pointer"
                    >
                      <rect
                        width="168"
                        height="54"
                        rx="8"
                        className={cn(
                          "fill-card stroke-border",
                          isSelected && "fill-primary/15 stroke-primary",
                          !isSelected && isAffected && "fill-accent/10 stroke-accent",
                        )}
                        strokeWidth={isSelected || isAffected ? 1.8 : 1}
                      />
                      <text x="12" y="22" className="fill-foreground text-[11px] font-medium">
                        {truncate(node.label, 23)}
                      </text>
                      <text x="12" y="39" className="fill-muted-foreground text-[9px]">
                        {truncate(node.detail, 30)}
                      </text>
                      <text x="156" y="18" textAnchor="end" className={cn("fill-muted-foreground text-[8px] uppercase", isSelected && "fill-primary")}>
                        {node.type}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Add components and artifacts to start the graph.
            </p>
          )}

          <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Selected</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Affected downstream</span>
            <span>Arrows point from a dependency to work that depends on it.</span>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card/70 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Preview a change
            </p>
            <Route className="size-4 text-accent" />
          </div>

          {selected ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-foreground">{selected.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{selected.detail}</p>

              {selected.type === "component" ? (
                <div className="mt-5 space-y-4">
                  <label className="block space-y-1.5">
                    <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Replacement catalog part
                    </span>
                    <select
                      value={replacementId}
                      onChange={(event) => {
                        setReplacementId(event.target.value);
                        setPreview(null);
                        setApplyMessage(null);
                      }}
                      className={selectClass}
                    >
                      {catalogParts.map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.category} · {part.partNumber} — {part.manufacturer}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Button
                    type="button"
                    onClick={runPreview}
                    disabled={previewPending || !replacement || replacement.partNumber === selected.label}
                    className="w-full"
                  >
                    <Repeat data-icon="inline-start" />
                    {previewPending ? "Computing impact..." : "Preview swap impact"}
                  </Button>

                  {preview?.ok === false ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {preview.message}
                    </p>
                  ) : null}

                  {preview?.ok ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-foreground">
                            {preview.fromLabel} → {preview.toLabel}
                          </h4>
                          <Badge
                            variant="outline"
                            className={preview.source === "ai"
                              ? "border-primary/35 bg-primary/10 font-mono text-[9px] text-primary"
                              : "border-border bg-muted/40 font-mono text-[9px] text-muted-foreground"}
                          >
                            {preview.source === "ai" ? "AI explanation" : "Computed summary"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-foreground/85">
                          {preview.explanation}
                        </p>
                      </div>

                      {preview.affected.length > 0 ? (
                        <ul className="divide-y divide-border border-y border-border">
                          {preview.affected.map((artifact) => (
                            <li key={artifact.id} className="py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium text-foreground">{artifact.label}</p>
                                <Badge variant="outline" className="numeric border-border bg-muted/40 text-[9px] text-muted-foreground">
                                  depth {artifact.depth}
                                </Badge>
                              </div>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                                {artifact.path.map((step, index) => (
                                  <span key={`${step}-${index}`} className="flex items-center gap-1">
                                    {index > 0 ? <ArrowRight className="size-3" /> : null}
                                    {step}
                                  </span>
                                ))}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                          No downstream artifacts are linked yet. Add component links below before relying on this preview.
                        </p>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={runApply}
                        disabled={applyPending || !previewMatches}
                        className="w-full"
                      >
                        {applyPending ? "Applying swap..." : "Apply this swap"}
                      </Button>
                    </div>
                  ) : null}

                  <ActionStateMessage state={applyMessage} />
                </div>
              ) : (
                <div className="mt-5">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Artifact selected. Its downstream work is highlighted in the graph. Select a component when you want to preview and apply a part swap.
                  </p>
                  {ripple && ripple.affected.length > 0 ? (
                    <ul className="mt-3 divide-y divide-border border-y border-border">
                      {ripple.affected.map((step) => (
                        <li key={nodeKey(step.node)} className="flex items-center justify-between py-2 text-xs">
                          <span className="text-foreground">{step.node.label}</span>
                          <span className="numeric text-muted-foreground">depth {step.depth}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No downstream work is recorded for this artifact.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Add a component or artifact to preview a change.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card/70 p-5">
          <h3 className="text-sm font-medium text-foreground">Component links</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            These links decide what a component swap affects. Link each selected part to the boards, firmware, or documents it feeds.
          </p>
          <div className="mt-4">
            <ComponentLinkForm projectId={projectId} components={components} artifacts={artifacts} />
          </div>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {graph.edges.filter((edge) => edge.source === "component-link").map((edge) => {
              const from = graph.nodes.find((node) => nodeKey(node) === nodeKey(edge.from));
              const to = graph.nodes.find((node) => nodeKey(node) === nodeKey(edge.to));
              return (
                <li key={edge.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    <span className="text-foreground">{from?.label}</span> {edge.kind} <span className="text-foreground">{to?.label}</span>
                  </span>
                  <DeleteGraphRecord action={deleteComponentLinkAction} projectId={projectId} recordId={edge.id} label="Delete component link" />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card/70 p-5">
          <h3 className="text-sm font-medium text-foreground">Artifact edges</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Artifact edges carry the ripple downstream — for example, a schematic informs firmware, and a datasheet documents a schematic.
          </p>
          <div className="mt-4">
            <ArtifactEdgeForm projectId={projectId} artifacts={artifacts} />
          </div>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {graph.edges.filter((edge) => edge.source === "artifact-edge").map((edge) => {
              const from = graph.nodes.find((node) => nodeKey(node) === nodeKey(edge.from));
              const to = graph.nodes.find((node) => nodeKey(node) === nodeKey(edge.to));
              return (
                <li key={edge.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    <span className="text-foreground">{from?.label}</span> {edge.kind.replaceAll("_", " ")} <span className="text-foreground">{to?.label}</span>
                  </span>
                  <DeleteGraphRecord action={deleteArtifactEdgeAction} projectId={projectId} recordId={edge.id} label="Delete artifact edge" />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
