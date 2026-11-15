"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { CategoryDto } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The session's categories as tabs, in voting order, with the selected
 * category's content as the panel under them. A single category shows no
 * tabs, just `children`, so one-category sessions look as they always have.
 * Tabs in `done` get a check: the attendee has finished that category.
 */
export function CategoryTabs({
  categories,
  value,
  onValueChange,
  done,
  className,
  contentClassName,
  children,
}: {
  categories: readonly CategoryDto[];
  value: string;
  onValueChange: (categoryId: string) => void;
  done?: ReadonlySet<string>;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  if (categories.length < 2) {
    return <>{children}</>;
  }
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      className={className}
    >
      {/* Equal widths while the names fit; past that each tab keeps its
          name on one line and the bar scrolls sideways. */}
      <TabsList
        aria-label="Categories"
        className="auto-cols-[minmax(max-content,1fr)] overflow-x-auto"
      >
        {categories.map((category) => {
          const finished = done?.has(category.id) ?? false;
          return (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="whitespace-nowrap"
            >
              {finished && <Check aria-hidden className="size-4 text-success" />}
              {category.name}
              {finished && <span className="sr-only"> (done)</span>}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {/* A tighter gap on short (landscape) screens, where the swipe deck is
          already down to its minimum height. */}
      <TabsContent value={value} className={cn("mt-4 short:mt-2", contentClassName)}>
        {children}
      </TabsContent>
    </Tabs>
  );
}
