"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { createProjectAction } from "@/app/actions/projects";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMPARISON_PRESETS } from "@/lib/comparison/presets";

export function NewProjectButton({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    null,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Plus data-icon="inline-start" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="numeric text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            M2 · comparison-ready
          </p>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            The project starts with a comparison preset so hard constraints can
            be scored in code immediately. You can refine the brief later.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              placeholder="Greenhouse water monitor"
              minLength={2}
              maxLength={80}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-brief">Brief</Label>
            <Textarea
              id="project-brief"
              name="brief"
              placeholder="Describe what the project must do, the power budget, and the environment it lives in."
              rows={4}
              minLength={20}
              maxLength={2000}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-preset">Comparison preset</Label>
            <select
              id="project-preset"
              name="preset"
              defaultValue="level-sensor"
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {COMPARISON_PRESETS.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The preset adds requirement cards, deterministic constraints, and
              a first scored candidate set.
            </p>
          </div>

          {state?.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
