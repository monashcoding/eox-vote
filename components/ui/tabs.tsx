import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export function Tabs({
  className,
  ...props
}: TabsPrimitive.Root.Props): React.JSX.Element {
  return <TabsPrimitive.Root className={cn("w-full", className)} {...props} />;
}

export function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props): React.JSX.Element {
  return (
    <TabsPrimitive.List
      className={cn(
        // Mobile height comes from the 44px triggers plus padding and border,
        // so the triggers never overflow the list. Desktop uses the 36px list.
        "grid w-full grid-flow-col auto-cols-fr items-center rounded-control border-2 border-border bg-surface-soft p-1 text-muted md:h-9",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.Tab.Props): React.JSX.Element {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-control border-2 border-transparent px-3 py-1 text-sm font-medium transition-colors duration-150 ease-reveal outline-none md:h-full md:min-h-0",
        "hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        "data-active:border-border-strong data-active:bg-card data-active:font-semibold data-active:text-foreground",
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
