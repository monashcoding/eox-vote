import { and, asc, eq, inArray } from "drizzle-orm";
import { Stage, type CategoryDto } from "./api-types";
import {
  DEFAULT_CATEGORY_NAME,
  normaliseCategoryList,
  onlyRenames,
  type CategoryDraft,
} from "./category-fields";
import { db, type DbReader, type DbTransaction } from "./db";
import { categories, sessions } from "./db/schema";
import { HttpError, requireUuid } from "./http";

/** A session's categories in voting order. */
export async function listCategories(
  sessionId: string,
  executor: DbReader = db
): Promise<CategoryDto[]> {
  return await executor
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.sessionId, sessionId))
    .orderBy(asc(categories.position), asc(categories.id));
}

/** Every new session starts with one category. */
export async function insertDefaultCategory(
  tx: DbTransaction,
  sessionId: string
): Promise<void> {
  await tx
    .insert(categories)
    .values({ sessionId, name: DEFAULT_CATEGORY_NAME, position: 0 });
}

export function requireCategoryId(id: string): string {
  return requireUuid(id, "Category not found");
}

/**
 * Share-locks a category of `sessionId` so it cannot be deleted before the
 * caller's vote is written; 404 when the session has no such category.
 */
export async function lockSessionCategoryInTx(
  tx: DbTransaction,
  sessionId: string,
  categoryId: string
): Promise<void> {
  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.sessionId, sessionId)))
    .for("share");
  if (!row) {
    throw new HttpError(404, "Category not found");
  }
}

/**
 * Makes `drafts` the session's whole category list, in order: saved
 * categories are renamed and moved, missing ones deleted with their votes,
 * and new ones (id `null`) added. Once the session is showing results only
 * renames are allowed, as adding, removing or moving a category would change
 * which places the reveal counter has already shown. The caller must hold the
 * session row lock (`syncSessionInTx`).
 */
export async function replaceCategoriesInTx(
  tx: DbTransaction,
  session: Pick<typeof sessions.$inferSelect, "id" | "stage">,
  drafts: readonly CategoryDraft[]
): Promise<void> {
  const checked = normaliseCategoryList(drafts);
  if ("error" in checked) {
    throw new HttpError(400, checked.error);
  }
  const current = await listCategories(session.id, tx);
  const currentIds = new Set(current.map((category) => category.id));
  const keptIds = new Set<string>();
  for (const draft of checked.categories) {
    if (draft.id === null) continue;
    if (!currentIds.has(draft.id) || keptIds.has(draft.id)) {
      throw new HttpError(400, "A category in the list is not part of this session");
    }
    keptIds.add(draft.id);
  }
  if (
    (session.stage === Stage.Results || session.stage === Stage.Finished) &&
    !onlyRenames(current, checked.categories)
  ) {
    throw new HttpError(
      409,
      "Once results are shown, categories can only be renamed"
    );
  }

  const removedIds = current
    .map((category) => category.id)
    .filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    await tx
      .delete(categories)
      .where(
        and(eq(categories.sessionId, session.id), inArray(categories.id, removedIds))
      );
  }
  const now = new Date();
  for (const [position, draft] of checked.categories.entries()) {
    if (draft.id === null) {
      await tx
        .insert(categories)
        .values({ sessionId: session.id, name: draft.name, position });
    } else {
      await tx
        .update(categories)
        .set({ name: draft.name, position, updatedAt: now })
        .where(eq(categories.id, draft.id));
    }
  }
}
