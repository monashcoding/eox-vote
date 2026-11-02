import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        "bg-accent text-accent-foreground font-semibold hover:brightness-105 active:scale-[0.98]",
      secondary:
        "bg-surface text-foreground border border-white/10 hover:border-white/20 active:scale-[0.98]",
      ghost:
        "text-muted-foreground hover:text-foreground hover:bg-white/5 active:scale-[0.98]",
      danger:
        "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 active:scale-[0.98]",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "px-3 py-1.5 text-xs rounded-md",
      md: "px-4 py-2 text-sm rounded-md",
      lg: "px-5 py-2.5 text-base rounded-md",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-reveal select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
