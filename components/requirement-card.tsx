import { Card, CardContent } from "@/components/ui/card";
import {
  RequirementKindBadge,
  RequirementStatusBadge,
} from "@/components/status-badges";

type RequirementCardProps = {
  requirement: {
    id: string;
    text: string;
    kind: string;
    status: string;
  };
  index: number;
};

export function RequirementCard({
  requirement,
  index,
}: RequirementCardProps) {
  return (
    <Card
      size="sm"
      className="gap-0 border border-border bg-card/70 py-0 shadow-none ring-0 transition-colors hover:border-primary/30"
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="numeric pt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            REQ-{String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex flex-wrap justify-end gap-1.5">
            <RequirementKindBadge kind={requirement.kind} />
            <RequirementStatusBadge status={requirement.status} />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">
          {requirement.text}
        </p>
      </CardContent>
    </Card>
  );
}
