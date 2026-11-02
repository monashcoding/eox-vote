import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control font-medium whitespace-nowrap transition-all duration-150 ease-reveal outline-none select-none active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-2 border-transparent bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
        outline:
          "border-2 border-border bg-card text-foreground hover:border-border-strong hover:bg-accent",
        secondary:
          "border-2 border-border bg-surface-soft text-foreground hover:bg-accent",
        ghost:
          "border-2 border-transparent text-muted hover:bg-accent hover:text-foreground",
        destructive:
          "border-2 border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        link: "h-auto border-none p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-4 text-base compact:h-9 compact:gap-1.5 compact:px-3 compact:text-sm",
        sm: "h-11 gap-1.5 px-3 text-sm compact:h-8 compact:gap-1 compact:px-2.5 compact:text-xs",
        lg: "h-12 gap-2 px-5 text-base compact:h-10 compact:px-4",
        icon: "size-11 compact:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
