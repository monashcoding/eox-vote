import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Stage } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1 overflow-hidden whitespace-nowrap font-semibold transition-all [&_svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "rounded-tag bg-primary px-2 py-0.5 text-[11px] text-primary-foreground",
        live: "rounded-tag border border-live/50 bg-live/10 px-2 py-0.5 text-[11px] text-live",
        success:
          "rounded-tag border border-success/50 bg-success/10 px-2 py-0.5 text-[11px] text-success",
        info: "rounded-tag border border-info/50 bg-info/10 px-2 py-0.5 text-[11px] text-info",
        danger:
          "rounded-tag border border-danger/50 bg-danger/10 px-2 py-0.5 text-[11px] text-danger",
        outline:
          "rounded-control border-2 border-border bg-surface-soft px-2.5 py-1 text-xs text-muted",
      },
      /** Tag style: uppercase micro-label, per the eyebrow rule. */
      tag: {
        true: "uppercase tracking-[0.08em]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      tag: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  tag,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant, tag }), className)} {...props} />
  );
}

const stageLabels: Record<Stage, string> = {
  pending: "Pending",
  nominating: "Nominating",
  voting: "Voting",
  results: "Results",
  finished: "Finished",
};

const stageVariants: Record<Stage, NonNullable<BadgeProps["variant"]>> = {
  pending: "outline",
  nominating: "live",
  voting: "live",
  results: "info",
  finished: "success",
};

/** Stage tag. Open stages (nominating, voting) get the pulsing live dot. */
export function StagePill({
  stage,
  className,
}: {
  stage: Stage;
  className?: string;
}): React.JSX.Element {
  const isOpen = stage === Stage.Nominating || stage === Stage.Voting;
  return (
    <Badge
      variant={stageVariants[stage] ?? "outline"}
      tag
      className={cn(stage === Stage.Pending && "px-2 py-0.5 text-[11px]", className)}
    >
      {isOpen && (
        <span
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-live motion-reduce:animate-none"
        />
      )}
      {stageLabels[stage] ?? stage}
    </Badge>
  );
}

/** Marks the session attendees are currently looking at. Yellow: the active item. */
export function CurrentBadge({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <Badge tag className={className}>
      Current
    </Badge>
  );
}
