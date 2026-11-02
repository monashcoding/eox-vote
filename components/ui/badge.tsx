import * as React from "react";
import { Stage } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "secondary" | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps): React.JSX.Element {
  const variantStyles = {
    default: "bg-surface-deep text-foreground border border-white/10",
    accent: "bg-accent text-accent-foreground font-semibold",
    secondary: "bg-surface text-muted-foreground border border-white/10",
    outline: "text-foreground border border-white/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.1em]",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

const stageLabels: Record<Stage, string> = {
  pending: "Pending",
  nominating: "Nominating",
  voting: "Voting",
  results: "Results",
  finished: "Finished",
};

const stageStyles: Record<Stage, string> = {
  pending: "bg-white/5 text-muted-foreground border-white/10",
  nominating: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  voting: "bg-accent/15 text-accent border-accent/30 font-semibold",
  results: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  finished: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export function StagePill({
  stage,
  className,
}: {
  stage: Stage;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-[0.12em]",
        stageStyles[stage] ?? stageStyles.pending,
        className
      )}
    >
      {stageLabels[stage] ?? stage}
    </span>
  );
}

export function CurrentBadge({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      Current
    </span>
  );
}
