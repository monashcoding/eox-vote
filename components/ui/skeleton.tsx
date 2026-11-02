import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-panel bg-surface-soft/60 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

/** Centered spinner with an optional sentence-case status line. */
export function Spinner({
  label,
  className,
}: {
  label?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" />
      {label ? (
        <span className="text-xs font-medium text-muted">{label}</span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
