import {
  BookOpen,
  CircuitBoard,
  Cpu,
  FileText,
  FlaskConical,
  GitBranch,
  Layers,
  Package,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

const artifactIcons: Record<string, LucideIcon> = {
  schematic: CircuitBoard,
  pcb: Layers,
  firmware: Cpu,
  datasheet: FileText,
  bom: Package,
  test: FlaskConical,
  decision: GitBranch,
  doc: BookOpen,
};

type ArtifactRowProps = {
  artifact: {
    id: string;
    kind: string;
    name: string;
    version: string;
    hash: string;
  };
};

export function ArtifactRow({ artifact }: ArtifactRowProps) {
  const Icon = artifactIcons[artifact.kind] ?? FileText;

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {artifact.name}
          </span>
          <Badge
            variant="outline"
            className="numeric border-border bg-muted/40 text-[10px] text-muted-foreground"
          >
            {artifact.version}
          </Badge>
        </div>
        <p
          className="numeric mt-0.5 truncate text-[10px] text-muted-foreground"
          title={artifact.hash}
        >
          {artifact.hash}
        </p>
      </div>
      <span className="numeric shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {artifact.kind}
      </span>
    </div>
  );
}
