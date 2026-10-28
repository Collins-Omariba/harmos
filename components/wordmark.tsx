import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none font-heading text-[19px] font-semibold tracking-[-0.04em] text-foreground",
        className,
      )}
    >
      Harmos
    </span>
  );
}
