"use client";

import { useState, useTransition } from "react";
import { ExternalLink, PackagePlus, Search } from "lucide-react";

import {
  importLcscPartAction,
  previewLcscImportAction,
  type LcscPreview,
} from "@/app/actions/distributors";
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
import { CATALOG_CATEGORIES } from "@/lib/catalog/types";
import { AddButton } from "@/components/record-dialog";
import { cn } from "@/lib/utils";

type Notice = { ok: boolean; text: string } | null;

/**
 * Look up an LCSC product code and import it into the local catalog.
 * Lookup never writes; import re-fetches the row and validates it like any
 * other catalog write (unique MPN, real datasheet, human-chosen category).
 */
export function LcscImportDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<LcscPreview | null>(null);
  const [category, setCategory] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, startTransition] = useTransition();

  function lookup() {
    setNotice(null);
    setPreview(null);
    startTransition(async () => {
      const result = await previewLcscImportAction(code);
      if (!result.ok) {
        setNotice({ ok: false, text: result.message });
        return;
      }
      setPreview(result.part);
      setCategory(result.part.categoryGuess ?? "");
    });
  }

  function importPart() {
    if (!preview) return;
    setNotice(null);
    startTransition(async () => {
      const result = await importLcscPartAction(preview.productCode, category);
      setNotice({ ok: result.ok, text: result.message });
      if (result.ok) {
        setPreview(null);
        setCode("");
        setCategory("");
      }
    });
  }

  function reset() {
    setCode("");
    setPreview(null);
    setCategory("");
    setNotice(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <AddButton label="Import from LCSC" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-4 text-primary" />
            Import from LCSC
          </DialogTitle>
          <DialogDescription>
            Enter an LCSC product code (e.g. C25804). The row is copied into
            your local catalog — you choose the category before it lands.
            Uses the official LCSC API when keys are configured, otherwise
            the throttled public search.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && code.trim()) {
                  event.preventDefault();
                  lookup();
                }
              }}
              placeholder="C25804"
              aria-label="LCSC product code"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            <Button
              type="button"
              onClick={lookup}
              disabled={busy || code.trim().length < 2}
            >
              <Search data-icon="inline-start" />
              {busy ? "Looking up..." : "Look up"}
            </Button>
          </div>

          {preview ? (
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <p className="font-mono text-sm font-medium text-foreground">
                {preview.mpn || preview.productCode}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {preview.manufacturer}
                {preview.packageName ? ` · ${preview.packageName}` : ""}
                {preview.priceUsd !== null
                  ? ` · $${preview.priceUsd.toFixed(4)}`
                  : preview.listingPrice
                    ? ` · ${preview.listingPrice}`
                    : " · no price"}
                {preview.inStock ? " · in stock" : ""}
              </p>
              {preview.description ? (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {preview.description}
                </p>
              ) : null}
              <p className="numeric mt-1.5 text-[11px] text-muted-foreground">
                {preview.categoryPath.join(" / ") || "Uncategorized on LCSC"}
              </p>
              <p className="numeric mt-1 text-[11px] text-muted-foreground">
                {preview.mappedSpecCount} specs map to the scorer
                {preview.parameterCount > 0
                  ? ` (${preview.parameterCount} LCSC parameters on file)`
                  : ""}
              </p>
              <p className="mt-1.5 flex flex-wrap gap-3 text-[11px]">
                {preview.datasheetUrl ? (
                  <a
                    href={preview.datasheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    Datasheet <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-destructive">
                    No datasheet on file — cannot import
                  </span>
                )}
                {preview.sourceUrl ? (
                  <a
                    href={preview.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    LCSC page <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </p>

              <label className="mt-3 block space-y-1.5">
                <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Catalog category
                  {preview.categoryGuess
                    ? ` (suggested: ${preview.categoryGuess})`
                    : ""}
                </span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="">Choose a category...</option>
                  {CATALOG_CATEGORIES.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {notice ? (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-xs",
                notice.ok
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-destructive/30 bg-destructive/5 text-destructive",
              )}
            >
              {notice.text}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {preview ? (
            <Button
              type="button"
              onClick={importPart}
              disabled={
                busy || !category || !preview.datasheetUrl || !preview.mpn
              }
            >
              <PackagePlus data-icon="inline-start" />
              {busy ? "Importing..." : `Import ${preview.productCode}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
