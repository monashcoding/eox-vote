"use client";

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
 * inner padding, and its rounded border frames and clips them. Tabs share the
 * width equally, but none gets narrower than 5rem or its longest word; past
 * that the bar scrolls sideways, with no scrollbar, and the active tab is
 * brought to the middle whenever it changes. Touch height comes from the 44px
 * tabs; fine-pointer desktop is 36px unless a label wraps.
 */
export function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const reveal = () => {
      const tab = list.querySelector<HTMLElement>(
        '[role="tab"][aria-selected="true"]'
      );
      if (!tab || list.scrollWidth <= list.clientWidth) return;
      const listBox = list.getBoundingClientRect();
      const tabBox = tab.getBoundingClientRect();
      const start =
        tabBox.left - listBox.left - list.clientLeft + list.scrollLeft;
      list.scrollTo({ left: start - (list.clientWidth - tabBox.width) / 2 });
    };
    reveal();
    // Also when the selection changes from outside the bar, such as a
    // finished deck moving on to a category past the edge.
    const observer = new MutationObserver(reveal);
    observer.observe(list, { subtree: true, attributeFilter: ["aria-selected"] });
    return () => observer.disconnect();
  }, []);
  return (
    <TabsPrimitive.List
      className={cn(
        "grid w-full auto-cols-[minmax(min-content,1fr)] grid-flow-col overflow-x-auto overscroll-x-contain rounded-control border-2 border-border bg-surface-soft text-muted [scrollbar-width:none] motion-safe:scroll-smooth compact:min-h-9",
        className
      )}
      {...props}
      ref={ref}
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
        "relative inline-flex min-h-11 min-w-20 cursor-pointer items-center justify-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors duration-150 ease-reveal outline-none compact:min-h-8",
        "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "data-active:bg-accent data-active:font-semibold data-active:text-foreground",
        className
      )}
      {...props}
    />
  );
}

/**
 * A tab label that can be long, like a category name: it wraps onto a second
 * line and ends in an ellipsis past that, so the bar stays one row high. The
 * tab is never narrower than the label's longest word.
 */
export function TabsLabel({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="line-clamp-2 text-center leading-tight">{children}</span>
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
