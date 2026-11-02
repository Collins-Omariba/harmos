"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { proposeCatalogPartsAction } from "@/app/actions/catalog";
import { AiProgress } from "@/components/ai-progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DraftMissingPartButton({
  category,
  constraintLabel,
}: {
  category: string;
  constraintLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    proposeCatalogPartsAction,
    null,
  );

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <form action={formAction}>
        <input
          type="hidden"
          name="request"
          value={`Find real catalog parts in category ${category} that satisfy this project constraint: ${constraintLabel}. Prefer manufacturer-sourced parts; leave price empty if unknown.`}
        />
        <input type="hidden" name="categoryHint" value={category} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          disabled={pending}
        >
          <Sparkles data-icon="inline-start" />
          {pending ? "Drafting..." : "Draft missing"}
        </Button>
      </form>
      {pending ? (
        <AiProgress label="Drafting parts" compact className="max-w-64" />
      ) : null}
      {state ? (
        <span
          className={cn(
            "max-w-64 text-[11px] leading-snug",
            state.ok ? "text-primary" : "text-destructive",
          )}
        >
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
