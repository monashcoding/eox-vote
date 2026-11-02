import * as React from "react";
import { cn } from "@/lib/utils";

export const Mascot = {
  Wave: "/mascots/min-wave.svg",
  ArmsUp: "/mascots/min-arms-up.svg",
  Sad: "/mascots/min-sad.svg",
} as const;

export type Mascot = (typeof Mascot)[keyof typeof Mascot];

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Min pose on a neutral card (Option B). Omit for a text-only state. */
  mascot?: Mascot;
  /** Call to action, usually a `<Button>`. */
  action?: React.ReactNode;
  /** Heading level for the title. Defaults to h2. */
  as?: "h1" | "h2" | "h3";
}

/** Empty, waiting and error state: neutral card, optional Min mascot, sentence-case copy. */
export function EmptyState({
  title,
  description,
  mascot,
  action,
  as: Heading = "h2",
  className,
  ...props
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-panel border-2 border-border bg-card p-8 text-center md:p-12",
        className
      )}
      {...props}
    >
      {mascot && (
        <img src={mascot} alt="" aria-hidden className="size-28 md:size-32" />
      )}
      <Heading className="mt-4 text-xl font-semibold text-foreground">
        {title}
      </Heading>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Inline error callout: danger tint, 2px border, alert role. */
export function ErrorNote({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}): React.JSX.Element | null {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-control border-2 border-danger/50 bg-danger/10 p-3 text-sm leading-relaxed text-foreground",
        className
      )}
    >
      <span className="font-semibold text-danger">Error: </span>
      {message}
    </div>
  );
}
