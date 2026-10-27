import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none text-[17px] font-semibold tracking-[-0.025em] text-foreground",
        className,
      )}
    >
      Harmos
    </span>
  );
}
