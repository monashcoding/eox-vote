import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export function Tabs({
  className,
  ...props
}: TabsPrimitive.Root.Props): React.JSX.Element {
  return <TabsPrimitive.Root className={cn("w-full", className)} {...props} />;
}

/**
 * A flat segmented bar (guide 17.8): the tabs fill it edge to edge with no
 * inner padding, and its rounded border frames and clips them. Touch height
 * comes from the 44px tabs; fine-pointer desktop uses the 36px list.
 */
export function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props): React.JSX.Element {
  return (
    <TabsPrimitive.List
      className={cn(
        "grid w-full grid-flow-col auto-cols-fr items-center overflow-hidden rounded-control border-2 border-border bg-surface-soft text-muted compact:h-9",
        className
      )}
      {...props}
    />
  );
}

/**
 * One tab of the bar: no rounding, border or gap of its own. The active tab is
 * the lighter fill with semibold text, so it never relies on colour alone, and
 * the focus ring is inset because the bar clips anything outside a tab.
 */
export function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.Tab.Props): React.JSX.Element {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 px-3 py-1 text-sm font-medium transition-colors duration-150 ease-reveal outline-none compact:h-full compact:min-h-0",
        "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "data-active:bg-accent data-active:font-semibold data-active:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: TabsPrimitive.Panel.Props): React.JSX.Element {
  return (
    <TabsPrimitive.Panel
      className={cn("mt-4 outline-none", className)}
      {...props}
    />
  );
}
