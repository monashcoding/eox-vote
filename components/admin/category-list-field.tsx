"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { AdminNomineeDto, CategoryDto } from "@/lib/api-types";
import {
  CATEGORY_NAME_MAX,
  MAX_CATEGORIES,
  type CategoryDraft,
} from "@/lib/category-fields";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One row of the editor. `key` is the saved id, or `new-N` for a new row, so
 * React keeps each input (and its focus) with its row when rows move.
 */
export interface CategoryRow extends CategoryDraft {
  key: string;
}

export function categoryRows(categories: readonly CategoryDto[]): CategoryRow[] {
  return categories.map(({ id, name }) => ({ key: id, id, name }));
}

interface CategoryListFieldProps {
  value: CategoryRow[];
  onChange: (rows: CategoryRow[]) => void;
  /** Used to count each saved category's votes before it is removed. */
  nominees: readonly AdminNomineeDto[];
  /** Results are shown: only renames are allowed. */
  locked: boolean;
  disabled?: boolean;
  error?: string | null;
}

/**
 * The session's ordered categories: rename, reorder, add and remove. Changes
 * stay local until the settings form is saved.
 */
export function CategoryListField({
  value,
  onChange,
  nominees,
  locked,
  disabled,
  error,
}: CategoryListFieldProps): React.JSX.Element {
  const [confirmingKey, setConfirmingKey] = React.useState<string | null>(null);
  // The row added last, so its input takes focus once it mounts.
  const focusKey = React.useRef<string | null>(null);
  // Keys for new rows. Not crypto.randomUUID: it only exists on HTTPS and
  // localhost, and hosts can open the console over plain http on a LAN.
  const newRowCount = React.useRef(0);
  const structureDisabled = disabled || locked;

  const move = (index: number, offset: -1 | 1) => {
    const next = [...value];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };

  const remove = (key: string) => {
    setConfirmingKey(null);
    onChange(value.filter((row) => row.key !== key));
  };

  const add = () => {
    const key = `new-${newRowCount.current++}`;
    focusKey.current = key;
    onChange([...value, { key, id: null, name: "" }]);
  };

  return (
    <div
      role="group"
      aria-labelledby="edit-categories-label"
      aria-describedby="edit-categories-help"
      className="space-y-2"
    >
      <Label id="edit-categories-label">Voting categories</Label>
      <ol className="space-y-2">
        {value.map((row, index) => {
          const label = row.name.trim() || `category ${index + 1}`;
          const id = row.id;
          const votes =
            id === null
              ? 0
              : nominees.reduce((sum, n) => sum + (n.votesByCategory[id] ?? 0), 0);
          return (
            <li key={row.key} className="space-y-2">
              <div className="flex items-center gap-1">
                <Input
                  ref={(el: HTMLInputElement | null) => {
                    if (el && focusKey.current === row.key) {
                      focusKey.current = null;
                      el.focus();
                    }
                  }}
                  aria-label={`Category ${index + 1} name`}
                  value={row.name}
                  onChange={(e) =>
                    onChange(
                      value.map((r) =>
                        r.key === row.key ? { ...r, name: e.target.value } : r
                      )
                    )
                  }
                  maxLength={CATEGORY_NAME_MAX}
                  disabled={disabled}
                  className="mr-1 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${label} up`}
                  disabled={structureDisabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${label} down`}
                  disabled={structureDisabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${label}`}
                  disabled={
                    structureDisabled ||
                    value.length <= 1 ||
                    confirmingKey === row.key
                  }
                  onClick={() =>
                    votes > 0 ? setConfirmingKey(row.key) : remove(row.key)
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              {confirmingKey === row.key && !structureDisabled && (
                <div className="flex flex-wrap items-center gap-2 rounded-control border-2 border-danger/40 bg-danger/5 p-2 pl-3">
                  <p className="flex-1 basis-48 text-sm text-foreground">
                    Its {votes.toLocaleString()} {votes === 1 ? "vote is" : "votes are"}{" "}
                    deleted when you save.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(row.key)}
                  >
                    Remove
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingKey(null)}
                  >
                    Keep
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={structureDisabled || value.length >= MAX_CATEGORIES}
        onClick={add}
      >
        <Plus />
        <span>Add category</span>
      </Button>
      <p id="edit-categories-help" className="text-xs text-muted">
        Attendees vote in each category in this order, and results are revealed
        in the same order.
      </p>
      {locked && (
        <p className="text-xs text-muted">
          Once results are shown, categories can only be renamed.
        </p>
      )}
      <ErrorNote message={error} />
    </div>
  );
}
