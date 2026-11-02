"use client";

import { useState, type FormEvent } from "react";
import { Copy, Sparkles } from "lucide-react";

import { AiProgress } from "@/components/ai-progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CATALOG_CATEGORIES } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { Field, TextArea, TextInput } from "@/components/record-dialog";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 text-[11px]"
      onClick={copy}
    >
      <Copy data-icon="inline-start" />
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * Shows the model's reply verbatim so the user can transcribe parts into the
 * add-part form by hand. Exported for tests.
 */
export function RawOutputBox({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-accent/35 bg-accent/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="numeric text-[10px] uppercase tracking-[0.16em] text-accent">
          AI suggestions — transcribe manually
        </p>
        <CopyButton text={text} />
      </div>
      <pre className="mt-2 max-h-64 overflow-auto rounded border border-border bg-background p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/85">
        {text}
      </pre>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Read through, verify anything doubtful, then add the parts you want
        with the add-part form — the same validation applies to manual rows.
      </p>
    </div>
  );
}

/**
 * Live provider thinking, shown only when the API actually streams
 * reasoning text. Exported for tests.
 */
export function ThinkingBox({ text }: { text: string }) {
  return (
    <details
      open
      className="rounded-md border border-border bg-muted/30 px-3 py-2"
    >
      <summary className="numeric cursor-pointer text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Model thinking — live from the provider
      </summary>
      <pre className="mt-2 max-h-40 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {text}
      </pre>
    </details>
  );
}

type ProposeState = { ok: boolean; message: string; rawOutput?: string } | null;

type StreamEvent = {
  type?: string;
  delta?: string;
  message?: string;
  rawOutput?: string;
};

function ProposeForm() {
  const [state, setState] = useState<ProposeState>(null);
  const [pending, setPending] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveReasoning, setLiveReasoning] = useState("");
  const [statusText, setStatusText] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setState(null);
    setLiveText("");
    setLiveReasoning("");
    setStatusText("Starting…");

    try {
      const response = await fetch("/api/catalog/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: form.get("request"),
          categoryHint: form.get("categoryHint") || undefined,
          sourceUrl: form.get("sourceUrl") || undefined,
          pastedText: form.get("pastedText") || undefined,
        }),
      });
      if (!response.ok || !response.body) {
        let message = "The AI could not draft parts right now — try again.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Keep the generic message.
        }
        setState({ ok: false, message });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let streamEvent: StreamEvent;
          try {
            streamEvent = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (streamEvent.type === "status" && streamEvent.message) {
            setStatusText(streamEvent.message);
          } else if (streamEvent.type === "reasoning" && streamEvent.delta) {
            setLiveReasoning((current) => current + streamEvent.delta);
          } else if (streamEvent.type === "text" && streamEvent.delta) {
            setLiveText((current) => current + streamEvent.delta);
          } else if (streamEvent.type === "done") {
            setState({
              ok: true,
              message: streamEvent.message ?? "Done.",
              rawOutput: streamEvent.rawOutput,
            });
          } else if (streamEvent.type === "error") {
            setState({
              ok: false,
              message: streamEvent.message ?? "The AI call failed.",
            });
          }
        }
        if (done) break;
      }
    } catch {
      setState({
        ok: false,
        message: "Could not reach the AI endpoint — try again.",
      });
    } finally {
      setPending(false);
      setStatusText(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <Field label="Manufacturer or datasheet link (recommended)" htmlFor="proposal-url">
          <TextInput
            id="proposal-url"
            name="sourceUrl"
            type="text" inputMode="url"
            placeholder="https://www.ti.com/lit/ds/symlink/…"
          />
        </Field>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Paste the product page or datasheet PDF link and the AI reads the
          real specs instead of answering from memory. Scanned PDFs have no
          readable text — paste their key table below in that case.
        </p>
      </div>
      <Field label="What should the catalog grow with?" htmlFor="proposal-request">
        <TextArea
          id="proposal-request"
          name="request"
          required
          rows={3}
          placeholder='Low-power LDOs under $1 in SOT-23 — or paste a datasheet excerpt below and say "extract this part"'
        />
      </Field>
      <Field label="Pasted reference text (optional — for scanned PDFs)" htmlFor="proposal-pasted">
        <TextArea
          id="proposal-pasted"
          name="pastedText"
          rows={4}
          placeholder="Copy the spec table or key paragraphs here…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category hint (optional)" htmlFor="proposal-category">
          <select
            id="proposal-category"
            name="categoryHint"
            defaultValue=""
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">Let the AI decide</option>
            {CATALOG_CATEGORIES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {pending ? (
        <div className="space-y-2">
          <AiProgress label="Drafting catalog parts" />
          {statusText ? (
            <p className="text-[11px] text-muted-foreground">{statusText}</p>
          ) : null}
          {!liveReasoning && !liveText ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              No thinking text yet — this provider usually keeps its reasoning
              hidden. The moment it starts writing, the answer streams in
              below.
            </p>
          ) : null}
          {liveReasoning ? <ThinkingBox text={liveReasoning} /> : null}
          {liveText ? (
            <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/85">
              {liveText}
              <span className="ml-0.5 animate-pulse">▍</span>
            </pre>
          ) : null}
        </div>
      ) : null}
      {state ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            state.ok
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          {state.message}
        </p>
      ) : null}
      {!pending && (state?.rawOutput || liveText) ? (
        <>
          {liveReasoning ? <ThinkingBox text={liveReasoning} /> : null}
          <RawOutputBox text={state?.rawOutput || liveText} />
        </>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Sparkles data-icon="inline-start" />
          {pending ? "Drafting…" : "Draft with AI"}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        The AI&apos;s reply shows up right here as readable text — nothing is
        written to the catalog. Transcribe the parts you want with the
        add-part form below.
      </p>
    </form>
  );
}

export function CatalogProposer() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Grow the catalog
          </p>
          <h2 className="mt-1.5 text-base font-medium text-foreground">
            Propose parts with AI
          </h2>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Sparkles data-icon="inline-start" />
            New proposal
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Propose catalog parts</DialogTitle>
            <DialogDescription>
              Describe what to add, or paste source text to extract.
            </DialogDescription>
          </DialogHeader>
          <ProposeForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
