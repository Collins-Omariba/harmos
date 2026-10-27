import { ExternalLink, PackageSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

type ComponentRow = {
  id: string;
  partNumber: string;
  manufacturer: string;
  package: string;
  datasheetUrl: string | null;
  notes: string | null;
};

export function ComponentTable({ components }: { components: ComponentRow[] }) {
  if (components.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No components yet"
        description="Components selected for this project will appear here with their package, datasheet, and notes."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
            <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
              Part
            </TableHead>
            <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
              Manufacturer
            </TableHead>
            <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
              Package
            </TableHead>
            <TableHead className="numeric text-[10px] uppercase tracking-[0.16em]">
              Datasheet
            </TableHead>
            <TableHead className="numeric hidden text-[10px] uppercase tracking-[0.16em] md:table-cell">
              Notes
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {components.map((component) => (
            <TableRow key={component.id} className="border-border">
              <TableCell className="numeric font-medium text-foreground">
                {component.partNumber}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {component.manufacturer}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="numeric border-border bg-muted/40 text-[10px] text-muted-foreground"
                >
                  {component.package}
                </Badge>
              </TableCell>
              <TableCell>
                {component.datasheetUrl ? (
                  <a
                    href={component.datasheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                  >
                    PDF
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden max-w-xs text-xs leading-relaxed text-muted-foreground md:table-cell">
                {component.notes ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
