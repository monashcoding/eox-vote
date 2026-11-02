import * as React from "react";
import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

/** Field label in the eyebrow style (uppercase micro-label). */
export function Label({ className, ...props }: LabelProps): React.JSX.Element {
  return (
    <label
      className={cn(
        "block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted select-none sm:text-[11px]",
        className
      )}
      {...props}
    />
  );
}

/** Eyebrow / micro-label for overlines, categories and section captions. */
export function Eyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-[11px]",
        className
      )}
      {...props}
    />
  );
}
