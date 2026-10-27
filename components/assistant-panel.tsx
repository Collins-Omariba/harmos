"use client";

import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const taskNames = [
  "extract_requirements",
  "clarifying_questions",
  "select_resources",
  "explain_comparison",
  "explain_change_impact",
];

export function AssistantPanel() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-12 shrink-0 flex-col items-center gap-3 border-l border-border bg-sidebar py-3 lg:flex">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
            aria-label="Open AI assistant panel"
          >
            <Sparkles />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full border-border bg-sidebar p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border p-5">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                AI assistant
              </SheetTitle>
              <Badge
                variant="outline"
                className="border-accent/35 bg-accent/10 font-mono text-[10px] uppercase tracking-[0.12em] text-accent"
              >
                Coming soon
              </Badge>
            </div>
            <SheetDescription>
              A reserved rail for task-shaped help. It is intentionally empty in
              v0.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 overflow-y-auto p-5">
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-5">
              <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                No calls in v0
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The assistant will never chat freely over your project. Each
                request will be a named, schema-validated task with a disk cache
                and a log line.
              </p>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Task contract
                </h3>
                <span className="numeric text-[10px] text-muted-foreground">
                  5
                </span>
              </div>
              <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/50">
                {taskNames.map((name, index) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="numeric text-[10px] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <code className="numeric text-xs text-foreground">
                      {name}
                    </code>
                  </li>
                ))}
              </ol>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Cache
                </p>
                <p className="numeric mt-1.5 text-[11px] text-foreground">
                  .cache/ai/
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Log
                </p>
                <p className="numeric mt-1.5 text-[11px] text-foreground">
                  logs/ai.log
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Deterministic checks — constraint satisfaction, dependency
              ripples, BOM totals, and version resolution — stay in code, not in
              the model.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <div className="h-px w-5 bg-border" />

      <span className="numeric text-[10px] uppercase tracking-[0.28em] text-muted-foreground [writing-mode:vertical-rl]">
        AI assistant
      </span>

      <div className="mt-auto flex flex-col items-center gap-2">
        <span className="size-1.5 rounded-full bg-accent/70" />
        <span className="numeric text-[9px] uppercase tracking-[0.18em] text-muted-foreground [writing-mode:vertical-rl]">
          v0
        </span>
      </div>
    </aside>
  );
}
