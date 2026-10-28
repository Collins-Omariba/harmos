"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { AssistantDialog } from "@/components/assistant-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Per-project entry point for the assistant. A floating sparkle at the
 * bottom-right of the project page opens a dialog scoped to that project —
 * no top-bar input, no rail. ⌘K / Ctrl+K works too while on a project.
 */
export function AssistantFab({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask about this project"
        title="Ask about this project (⌘K)"
        className={cn(
          "fixed right-5 bottom-5 z-40 size-12 rounded-full shadow-lg",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        <Sparkles className="size-5" />
      </Button>
      <AssistantDialog
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        projectName={projectName}
      />
    </>
  );
}
