import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

export type InputProps = InputPrimitive.Props;

export function Input({ className, ...props }: InputProps): React.JSX.Element {
  return (
    <InputPrimitive
      className={cn(
        "h-11 w-full min-w-0 rounded-control border-2 border-border bg-field px-3 py-1 text-base text-foreground outline-none transition-colors duration-150 ease-reveal placeholder:text-subtle md:h-9 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full min-w-0 rounded-control border-2 border-border bg-field p-3 text-base text-foreground outline-none transition-colors duration-150 ease-reveal placeholder:text-subtle md:text-sm",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
