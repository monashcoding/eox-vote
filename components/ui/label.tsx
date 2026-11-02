import * as React from "react";
import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps): React.JSX.Element {
  return (
    <label
      className={cn(
        "block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground select-none",
        className
      )}
      {...props}
    />
  );
}
