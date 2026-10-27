"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewProjectButton({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Plus data-icon="inline-start" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="numeric text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            M1 · reserved
          </p>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Project creation is not wired in v0. The seeded Water Tank Monitor
            project is the workspace for this milestone.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The next milestone adds the brief-to-requirements flow. Nothing you
            do here will write to the database yet.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
