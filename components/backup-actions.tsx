"use client";

import { useActionState, useState, useTransition } from "react";
import { Download, FileJson, Upload } from "lucide-react";

import {
  exportProjectAction,
  exportWorkspaceAction,
  importProjectAction,
  type ExportResult,
} from "@/app/actions/backup";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function download(result: ExportResult) {
  if (!result.ok) return;
  const blob = new Blob([result.content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportWorkspaceButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await exportWorkspaceAction();
            if (result.ok) download(result);
            else setMessage(result.message);
          })
        }
      >
        <Download data-icon="inline-start" />
        {pending ? "Preparing..." : "Backup workspace"}
      </Button>
      {message ? <span className="text-xs text-destructive">{message}</span> : null}
    </span>
  );
}

export function ExportProjectButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          download(await exportProjectAction(projectId));
        })
      }
    >
      <Download data-icon="inline-start" />
      {pending ? "Preparing..." : "Export project"}
    </Button>
  );
}

export function ImportProjectDialog() {
  const [open, setOpen] = useState(false);
  const [projectJson, setProjectJson] = useState("");
  const [state, formAction, pending] = useActionState(importProjectAction, null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setProjectJson(await file.text());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload data-icon="inline-start" />
          Import project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import project</DialogTitle>
          <DialogDescription>
            Import a Harmos project export. It is created as a new project;
            the original is never overwritten.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Export file
            </span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void readFile(event.target.files?.[0])}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm file:text-foreground"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Or paste export JSON
            </span>
            <textarea
              name="projectJson"
              value={projectJson}
              onChange={(event) => setProjectJson(event.target.value)}
              rows={7}
              placeholder='{"format":"harmos-project-export", ...}'
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            />
          </label>
          {state && !state.ok ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || projectJson.trim().length < 20}>
              <FileJson data-icon="inline-start" />
              {pending ? "Importing..." : "Import as new project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
