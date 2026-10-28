"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { SendHorizonal, Sparkles } from "lucide-react";

import { askAssistantAction, type AskResult } from "@/app/actions/assistant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  text: string;
  citations: { label: string; href: string }[];
  followUps: string[];
  source?: AskResult["source"];
};

function sourceLabel(source: AskResult["source"]): string | null {
  if (source === "computed") {
    return "Worked out, not guessed";
  }
  if (source === "ai") {
    return "Answered by AI from your data";
  }
  return null;
}

/**
 * Project-scoped ask dialog. No project picker, no top-bar input: it always
 * answers about the project whose page opened it. The panel is translucent
 * with backdrop blur so the workspace stays visible behind it.
 */
export function AssistantDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, startTransition] = useTransition();

  function ask(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 2 || pending) {
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "user", text: trimmed, citations: [], followUps: [] },
    ]);
    setInput("");

    startTransition(async () => {
      const result = await askAssistantAction({
        projectId,
        question: trimmed,
      });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.text,
          citations: result.citations,
          followUps: result.followUps,
          source: result.source,
        },
      ]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden border-border/60 bg-card/75 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 p-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Ask about {projectName}
          </DialogTitle>
          <DialogDescription>
            Answers come from this project&apos;s stored data, with links to
            where each fact lives.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-48 flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Try one of these, or ask anything in your own words:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "What does the BOM total?",
                  "What passed the comparison?",
                  "Which versions are current?",
                  "What sources did we select?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) =>
              message.role === "user" ? (
                <p
                  key={index}
                  className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm"
                >
                  {message.text}
                </p>
              ) : (
                <div
                  key={index}
                  className="w-fit max-w-[95%] rounded-2xl rounded-bl-md border border-border/60 bg-card/60 px-4 py-3 shadow-sm backdrop-blur-md"
                >
                  {message.source && sourceLabel(message.source) ? (
                    <p className="numeric mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {sourceLabel(message.source)}
                    </p>
                  ) : null}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {message.text}
                  </p>
                  {message.citations.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.citations.map((citation) => (
                        <Link
                          key={`${citation.label}-${citation.href}`}
                          href={citation.href}
                          onClick={() => onOpenChange(false)}
                          className="numeric rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/20"
                        >
                          {citation.label} →
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {message.followUps.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.followUps.map((followUp) => (
                        <button
                          key={followUp}
                          type="button"
                          onClick={() => ask(followUp)}
                          disabled={pending}
                          className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                        >
                          {followUp}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            )
          )}
          {pending ? (
            <p className="numeric animate-pulse text-xs text-muted-foreground">
              Looking through your project data…
            </p>
          ) : null}
        </div>

        <form
          className="flex items-center gap-2.5 border-t border-border/60 bg-background/40 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Ask anything about ${projectName}…`}
            aria-label="Ask a question"
            autoFocus
            className={cn(
              "h-12 min-w-0 flex-1 rounded-full border border-input bg-background/80 px-5 text-[15px] text-foreground shadow-inner",
              "placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
            )}
          />
          <button
            type="submit"
            disabled={pending || input.trim().length < 2}
            aria-label="Send question"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizonal className="size-5" />
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
