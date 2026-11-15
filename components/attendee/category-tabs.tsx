"use client";

import * as React from "react";
import type { CategoryDto } from "@/lib/api-types";
import {
  Tabs,
  TabsContent,
  TabsLabel,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BottomTabBar } from "./bottom-tab-bar";

/**
 * The session's categories as a tab bar at the bottom of the screen, sticky
 * over the scrolling content, with the selected category's content as the
 * panel above it. A single category shows no tabs, just `children`, so
 * one-category sessions look as they always have.
 */
export function CategoryTabs({
  categories,
  value,
  onValueChange,
  children,
}: {
  categories: readonly CategoryDto[];
  value: string;
  onValueChange: (categoryId: string) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  if (categories.length < 2) {
    return <>{children}</>;
  }
  return (
    // Fills the screen's column, so the bar sits at the bottom even when the
    // content above it is short.
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      className="flex flex-1 flex-col"
    >
      <TabsContent value={value} className="mt-0 flex-1">
        {children}
      </TabsContent>
      <BottomTabBar sticky>
        <TabsList aria-label="Categories">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              <TabsLabel>{category.name}</TabsLabel>
            </TabsTrigger>
          ))}
        </TabsList>
      </BottomTabBar>
    </Tabs>
  );
}
