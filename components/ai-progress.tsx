"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared "the AI is working" indicator for every AI-backed action.
 *
 * Why it looks like this: the current model is a reasoning model. It thinks
 * silently (often 20-90s) before writing anything, and most AI actions here
 * are Next server actions, which cannot push partial output to the browser
 * mid-call. So the honest, useful signal is: a spinner, an elapsed timer so
 * the wait feels measured rather than hung, rotating stage text, and a note
 * that silent thinking is expected. Where the provider does stream thinking
 * or answer text (the catalog proposal route), that text is shown live
 * alongside this indicator instead.
 *
 * Exported for tests.
 */
export function aiStageForElapsed(elapsedSeconds: number): string {
  if (elapsedSeconds < 5) {
    return "Sending your request to the model…";
  }
  if (elapsedSeconds < 20) {
    return "Thinking — reasoning models work silently before they start writing.";
  }
  if (elapsedSeconds < 45) {
    return "Still thinking — this is normal for a reasoning model, not a hang.";
  }
  return "Deep in thought — complex requests can take a minute or more. Hang tight.";
}

export function AiProgress({
  label = "Asking the AI",
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-md border border-primary/25 bg-primary/5 text-foreground",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        <p className={cn("font-medium", compact ? "text-[11px]" : "text-xs")}>
          {label}
          <span aria-hidden="true" className="ml-1 inline-flex gap-0.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1 animate-bounce rounded-full bg-primary"
                style={{ animationDelay: `${dot * 180}ms` }}
              />
            ))}
          </span>
        </p>
        <span className="numeric ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {elapsed}s
        </span>
      </div>
      {!compact ? (
        <>
          <div
            aria-hidden="true"
            className="mt-2 h-1 overflow-hidden rounded-full bg-primary/15"
          >
            <div className="h-full w-2/5 animate-ai-progress rounded-full bg-primary/70" />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {aiStageForElapsed(elapsed)}
          </p>
        </>
      ) : null}
    </div>
  );
}
