"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
import type { RecordActionState } from "@/app/actions/records";
import { cn } from "@/lib/utils";

export type RecordAction = (
  _previous: RecordActionState,
  formData: FormData,
) => Promise<RecordActionState>;

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="numeric text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(inputClass, "h-auto min-h-20 py-2", props.className)}
    />
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, "w-fit min-w-36", props.className)} />;
}

export function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/**
 * Add/Edit dialog shell. Owns the action state, shows the server error, and
 * closes itself on success.
 */
export function RecordDialog({
  title,
  description,
  action,
  submitLabel,
  trigger,
  children,
}: {
  title: string;
  description: string;
  action: RecordAction;
  submitLabel: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: RecordActionState, formData: FormData) => {
      const result = await action(previous, formData);
      if (result?.ok) {
        setOpen(false);
      }
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {children}
          {state && !state.ok ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm">
      <Plus data-icon="inline-start" />
      {label}
    </Button>
  );
}

export function EditButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-foreground"
      aria-label="Edit"
    >
      <Pencil className="size-3.5" />
    </Button>
  );
}

/** Two-click delete: first click arms, second click submits. */
export function DeleteButton({
  action,
  fields,
  label = "Delete",
}: {
  action: RecordAction;
  fields: Record<string, string>;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [, formAction, pending] = useActionState(action, null);

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        aria-label={label}
        onClick={() => setArmed(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1">
      <HiddenFields fields={fields} />
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        className="h-7 px-2 text-[11px]"
        disabled={pending}
      >
        {pending ? "Deleting..." : "Confirm"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={() => setArmed(false)}
      >
        Keep
      </Button>
    </form>
  );
}
