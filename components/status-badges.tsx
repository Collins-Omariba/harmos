import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleDot,
  CircleX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const projectStatusStyles: Record<string, string> = {
  active: "border-primary/35 bg-primary/10 text-primary",
  draft: "border-border bg-muted text-muted-foreground",
  archived: "border-border bg-muted text-muted-foreground",
};

const projectStatusDots: Record<string, string> = {
  active: "bg-primary",
  draft: "bg-muted-foreground",
  archived: "bg-muted-foreground",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        projectStatusStyles[status] ??
          "border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          projectStatusDots[status] ?? "bg-muted-foreground",
        )}
      />
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

const kindStyles: Record<string, string> = {
  mandatory: "border-primary/35 bg-primary/10 text-primary",
  preference: "border-accent/35 bg-accent/10 text-accent",
  unknown: "border-border bg-muted text-muted-foreground",
};

export function RequirementKindBadge({ kind }: { kind: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.12em]",
        kindStyles[kind] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {kind.replaceAll("_", " ")}
    </Badge>
  );
}

const statusStyles: Record<string, string> = {
  confirmed: "border-primary/30 bg-primary/5 text-primary",
  assumed: "border-accent/30 bg-accent/5 text-accent",
  needs_clarification: "border-destructive/35 bg-destructive/5 text-destructive",
};

export function RequirementStatusBadge({ status }: { status: string }) {
  const Icon =
    status === "confirmed"
      ? CircleCheck
      : status === "assumed"
        ? CircleAlert
        : status === "needs_clarification"
          ? CircleHelp
          : CircleDot;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-mono text-[10px] uppercase tracking-[0.12em]",
        statusStyles[status] ??
          "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

const candidateStyles: Record<string, string> = {
  pass: "border-primary/35 bg-primary/10 text-primary",
  review: "border-accent/35 bg-accent/10 text-accent",
  fail: "border-destructive/35 bg-destructive/10 text-destructive",
};

export function CandidateStatusBadge({ status }: { status: string }) {
  const Icon =
    status === "pass" ? CircleCheck : status === "review" ? CircleAlert : CircleX;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-mono text-[10px] uppercase tracking-[0.12em]",
        candidateStyles[status] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}
