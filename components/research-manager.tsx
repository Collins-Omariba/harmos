"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Plus,
  Sparkles,
} from "lucide-react";

import { createResourceAction, deleteResourceAction, fetchResourceDetails, importCatalogResourcesAction, runResourceSelectionAction, setResourceSelectionAction, updateResourceAction } from "@/app/actions/research";
import { Badge } from "@/components/ui/badge";
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
import { CATALOG_CATEGORIES, type CatalogPart } from "@/lib/catalog/types";
import { formatDate, padCount } from "@/lib/format";
import { RESOURCE_KINDS } from "@/lib/research";
import { cn } from "@/lib/utils";
import {
  DeleteButton,
  EditButton,
  Field,
  HiddenFields,
  NativeSelect,
  RecordDialog,
  TextArea,
  TextInput,
} from "@/components/record-dialog";

export type ResourceRow = {
  id: string;
  title: string;
  url: string;
  kind: string;
  summary: string;
  retrievedAt: Date;
  tags: string;
  selected: boolean;
  selectionNote: string;
};

function toDateInput(value: Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function tagList(tags: string): string[] {
  return tags
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function AddResourceDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, startFetching] = useTransition();
  const [state, formAction, pending] = useActionState(
    createResourceAction,
    null,
  );

  function fetchDetails() {
    setFetchError(null);
    startFetching(async () => {
      const result = await fetchResourceDetails({ url });
      if ("error" in result) {
        setFetchError(result.error);
        return;
      }
      setTitle((current) => current || result.title);
      setSummary((current) => current || result.summary);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus data-icon="inline-start" />
          Add resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction}>
          <HiddenFields fields={{ projectId }} />
          <DialogHeader>
            <DialogTitle>Add resource</DialogTitle>
            <DialogDescription>
              Paste a link first — title and summary fill themselves in.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <Field label="Link to the source" htmlFor="add-resource-url">
                <div className="flex items-center gap-2">
                  <TextInput
                    id="add-resource-url"
                    name="url"
                    type="text" inputMode="url"
                    required
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://…"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={fetchDetails}
                    disabled={fetching || url.trim().length < 8}
                  >
                    {fetching ? "Reading…" : "Fetch details"}
                  </Button>
                </div>
              </Field>
              {fetchError ? (
                <p className="mt-2 text-[11px] text-destructive">{fetchError}</p>
              ) : null}
            </div>
            <Field label="Title" htmlFor="add-resource-title">
              <TextInput
                id="add-resource-title"
                name="title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="TPS7A02 datasheet"
              />
            </Field>
            <Field label="Kind" htmlFor="add-resource-kind">
              <NativeSelect id="add-resource-kind" name="kind" defaultValue="datasheet">
                {RESOURCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Summary" htmlFor="add-resource-summary">
              <TextArea
                id="add-resource-summary"
                name="summary"
                required
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="What this source covers and why it matters here."
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Retrieved on" htmlFor="add-resource-date">
                <TextInput
                  id="add-resource-date"
                  name="retrievedAt"
                  type="date"
                  required
                  defaultValue={todayInput()}
                />
              </Field>
              <Field label="Tags (comma separated)" htmlFor="add-resource-tags">
                <TextInput
                  id="add-resource-tags"
                  name="tags"
                  placeholder="ldo, low-power"
                />
              </Field>
            </div>
            {state && !state.ok ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {state.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Indexing…" : "Index resource"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResourceFields({ resource }: { resource?: ResourceRow }) {
  const id = resource ? `resource-${resource.id}` : "resource-new";
  return (
    <>
      <Field label="Title" htmlFor={`${id}-title`}>
        <TextInput
          id={`${id}-title`}
          name="title"
          required
          defaultValue={resource?.title ?? ""}
          placeholder="TPS7A02 datasheet"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="URL" htmlFor={`${id}-url`}>
          <TextInput
            id={`${id}-url`}
            name="url"
            type="text" inputMode="url"
            required
            defaultValue={resource?.url ?? ""}
            placeholder="https://…"
          />
        </Field>
        <Field label="Kind" htmlFor={`${id}-kind`}>
          <NativeSelect
            id={`${id}-kind`}
            name="kind"
            defaultValue={resource?.kind ?? "datasheet"}
          >
            {RESOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Summary" htmlFor={`${id}-summary`}>
        <TextArea
          id={`${id}-summary`}
          name="summary"
          required
          rows={3}
          defaultValue={resource?.summary ?? ""}
          placeholder="What this source covers and why it matters here."
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Retrieved on" htmlFor={`${id}-date`}>
          <TextInput
            id={`${id}-date`}
            name="retrievedAt"
            type="date"
            required
            defaultValue={
              resource ? toDateInput(resource.retrievedAt) : todayInput()
            }
          />
        </Field>
        <Field label="Tags (comma separated)" htmlFor={`${id}-tags`}>
          <TextInput
            id={`${id}-tags`}
            name="tags"
            defaultValue={resource?.tags ?? ""}
            placeholder="ldo, low-power"
          />
        </Field>
      </div>
    </>
  );
}

function SelectToggle({
  projectId,
  resource,
}: {
  projectId: string;
  resource: ResourceRow;
}) {
  const [, formAction] = useActionState(setResourceSelectionAction, null);

  return (
    <form
      action={formAction}
      title={resource.selected ? "Remove from selection" : "Select"}
    >
      <HiddenFields
        fields={{
          projectId,
          recordId: resource.id,
          selected: resource.selected ? "0" : "1",
        }}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className={cn(
          "size-7",
          resource.selected
            ? "text-primary hover:text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={resource.selected ? "Deselect" : "Select"}
      >
        {resource.selected ? (
          <BookmarkCheck className="size-3.5" />
        ) : (
          <Bookmark className="size-3.5" />
        )}
      </Button>
    </form>
  );
}

function ImportFromCatalog({
  projectId,
  parts,
}: {
  projectId: string;
  parts: CatalogPart[];
}) {
  const [category, setCategory] = useState<string>(CATALOG_CATEGORIES[0]?.key ?? "");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const visible = parts.filter((part) => part.category === category);

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <RecordDialog
      title="Import from catalog"
      description="Datasheet and manufacturer links become indexed resources. Existing URLs are skipped."
      action={importCatalogResourcesAction}
      submitLabel={`Import ${checked.size} part${checked.size === 1 ? "" : "s"}`}
      trigger={
        <Button variant="outline" size="sm">
          Import from catalog
        </Button>
      }
    >
      <HiddenFields fields={{ projectId }} />
      <Field label="Category" htmlFor="import-category">
        <select
          id="import-category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setChecked(new Set());
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {CATALOG_CATEGORIES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {visible.map((part) => (
          <label
            key={part.id}
            className="flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-muted/40"
          >
            <input
              type="checkbox"
              name="catalogPartIds"
              value={part.id}
              checked={checked.has(part.id)}
              onChange={() => toggle(part.id)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="numeric block text-xs font-medium text-foreground">
                {part.partNumber}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {part.manufacturer} · {part.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </RecordDialog>
  );
}

export function ResearchManager({
  projectId,
  resources,
  catalogParts,
}: {
  projectId: string;
  resources: ResourceRow[];
  catalogParts: CatalogPart[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [selecting, startSelecting] = useTransition();
  const selected = resources.filter((resource) => resource.selected);

  function runSelection() {
    setMessage(null);
    startSelecting(async () => {
      const result = await runResourceSelectionAction(projectId);
      setMessage(result?.message ?? null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Cited sources
          </p>
          <h2 className="mt-1.5 text-base font-medium text-foreground">
            Selected references
          </h2>
        </div>
        <span className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {padCount(selected.length)} of {padCount(resources.length)} selected
        </span>
      </div>

      {selected.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {selected.map((resource, index) => (
            <div
              key={resource.id}
              className="rounded-lg border border-border bg-card/70 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="numeric text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  [{index + 1}] {resource.kind}
                </p>
                <span className="numeric shrink-0 text-[10px] text-muted-foreground">
                  {formatDate(resource.retrievedAt)}
                </span>
              </div>
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-start gap-1 text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                {resource.title}
                <ExternalLink className="mt-0.5 size-3 shrink-0" />
              </a>
              {resource.selectionNote ? (
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
                  {resource.selectionNote}
                </p>
              ) : null}
              {tagList(resource.tags).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagList(resource.tags).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-border bg-muted/40 font-mono text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing selected yet. Run the AI selection or bookmark rows in the
          index below.
        </p>
      )}

      <div className="rounded-lg border border-border bg-card/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Resource index
            </p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              The index is the selection universe: every citation below links
              a stored source.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={runSelection}
              disabled={selecting || resources.length === 0}
            >
              <Sparkles data-icon="inline-start" />
              {selecting ? "Selecting..." : "Run AI selection"}
            </Button>
            <ImportFromCatalog projectId={projectId} parts={catalogParts} />
            <AddResourceDialog projectId={projectId} />
          </div>
        </div>

        {message ? (
          <p
            className={cn(
              "mt-3 rounded-md border px-3 py-2 text-xs",
              message.startsWith("Selected")
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            {message}
          </p>
        ) : null}

        <div className="mt-4 divide-y divide-border border-y border-border">
          {resources.map((resource) => (
            <div key={resource.id} className="flex items-start gap-2 py-3">
              <SelectToggle projectId={projectId} resource={resource} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {resource.title}
                  </a>
                  <Badge
                    variant="outline"
                    className="border-border bg-muted/40 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    {resource.kind}
                  </Badge>
                  {resource.selected ? (
                    <Badge
                      variant="outline"
                      className="border-primary/35 bg-primary/10 font-mono text-[9px] uppercase tracking-[0.1em] text-primary"
                    >
                      selected
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {resource.summary}
                </p>
                <p className="numeric mt-0.5 text-[10px] text-muted-foreground">
                  retrieved {formatDate(resource.retrievedAt)}
                  {tagList(resource.tags).length > 0
                    ? ` · ${tagList(resource.tags).join(", ")}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <RecordDialog
                  title="Edit resource"
                  description="Keep the index accurate: summaries and tags feed selection."
                  action={updateResourceAction}
                  submitLabel="Save changes"
                  trigger={<EditButton />}
                >
                  <HiddenFields
                    fields={{ projectId, recordId: resource.id }}
                  />
                  <ResourceFields resource={resource} />
                </RecordDialog>
                <DeleteButton
                  action={deleteResourceAction}
                  fields={{ projectId, recordId: resource.id }}
                  label="Delete resource"
                />
              </div>
            </div>
          ))}
          {resources.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              The index is empty. Import from the catalog or add a resource
              above.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
