"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Base UI select parts with the guide's recipe (17.3). Base UI handles
 * keyboard, typeahead, focus return and touch; on touch the popup opens below
 * the trigger rather than over it. Rows are 44 px on touch, compact on desktop.
 */
export const Select = SelectPrimitive.Root;

export function SelectLabel({
  className,
  ...props
}: SelectPrimitive.Label.Props): React.JSX.Element {
  return (
    <SelectPrimitive.Label
      className={cn(
        "block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted select-none sm:text-[11px]",
        className
      )}
      {...props}
    />
  );
}

export function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props): React.JSX.Element {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-control border-2 border-border bg-field px-3 text-left text-base text-foreground outline-none transition-colors duration-150 ease-reveal select-none compact:h-9 compact:text-sm",
        "hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 data-[popup-open]:border-ring",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex shrink-0 text-muted">
        <ChevronsUpDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props): React.JSX.Element {
  return (
    <SelectPrimitive.Value
      className={cn("flex min-w-0 flex-1 items-center gap-2 data-[placeholder]:text-subtle", className)}
      {...props}
    />
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props): React.JSX.Element {
  return (
    <SelectPrimitive.Portal>
      {/* Always below the trigger, so it reads the same with mouse and touch. */}
      <SelectPrimitive.Positioner
        alignItemWithTrigger={false}
        sideOffset={4}
        collisionPadding={8}
        className="z-50 outline-none select-none"
      >
        <SelectPrimitive.Popup
          className={cn(
            "max-w-[var(--available-width)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] rounded-panel border-2 border-border bg-card p-1 text-foreground shadow-float outline-none",
            "transition-[opacity,scale] duration-150 ease-reveal data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:scale-100",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List className="max-h-[min(24rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain">
            {children}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/** A row; the selected one gets a check and semibold text, not colour alone. */
export function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props): React.JSX.Element {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center gap-3 rounded-control py-2 pr-9 pl-3 text-base text-foreground outline-none select-none data-[highlighted]:bg-accent data-[selected]:font-semibold compact:min-h-9 compact:py-1.5 compact:text-sm",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.ItemIndicator className="absolute right-3 flex text-primary">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export const SelectItemText = SelectPrimitive.ItemText;

export function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props): React.JSX.Element {
  return (
    <SelectPrimitive.Separator
      className={cn("mx-2 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}
