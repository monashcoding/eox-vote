/** Name of the category every new session starts with. */
export const DEFAULT_CATEGORY_NAME = "Best Dressed";
export const MAX_CATEGORIES = 6;
export const CATEGORY_NAME_MAX = 40;

export const CATEGORY_NAME_ERROR = `Category names must be between 1 and ${CATEGORY_NAME_MAX} characters`;
export const CATEGORY_COUNT_ERROR = `A session needs between 1 and ${MAX_CATEGORIES} categories`;
export const CATEGORY_DUPLICATE_ERROR = "Each category needs a different name";

/** One category in a session's list: a saved one has its id, a new one `null`. */
export interface CategoryDraft {
  id: string | null;
  name: string;
}

/** Trims and collapses whitespace; null when the name is empty or too long. */
export function normaliseCategoryName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= CATEGORY_NAME_MAX ? name : null;
}

/**
 * Checks a session's whole category list, in voting order: 1 to
 * MAX_CATEGORIES categories with valid names that differ ignoring case.
 * Returns the list with names normalised, or the first problem.
 */
export function normaliseCategoryList(
  list: readonly CategoryDraft[]
): { categories: CategoryDraft[] } | { error: string } {
  if (list.length < 1 || list.length > MAX_CATEGORIES) {
    return { error: CATEGORY_COUNT_ERROR };
  }
  const categories: CategoryDraft[] = [];
  const seen = new Set<string>();
  for (const draft of list) {
    const name = normaliseCategoryName(draft.name);
    if (name === null) return { error: CATEGORY_NAME_ERROR };
    const key = name.toLowerCase();
    if (seen.has(key)) return { error: CATEGORY_DUPLICATE_ERROR };
    seen.add(key);
    categories.push({ id: draft.id, name });
  }
  return { categories };
}

/**
 * True when `next` has exactly the categories of `current` in the same order,
 * whatever their names: only renames, nothing added, removed or moved.
 */
export function onlyRenames(
  current: readonly { id: string }[],
  next: readonly CategoryDraft[]
): boolean {
  return (
    current.length === next.length &&
    current.every((category, index) => next[index].id === category.id)
  );
}
