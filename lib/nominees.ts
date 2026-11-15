import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { AdminNomineeDto, PublicNomineeDto } from "./api-types";
import { db, type DbReader } from "./db";
import { requireUuid } from "./http";
import { nominees, votes } from "./db/schema";

type NomineeRow = typeof nominees.$inferSelect;

export function toPublicNomineeDto(row: NomineeRow): PublicNomineeDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    photoUrl: `/api/photos/${row.id}?v=${row.photoVersion}`,
  };
}

export function toAdminNomineeDto(
  row: NomineeRow,
  votesByCategory: Record<string, number>
): AdminNomineeDto {
  return {
    ...toPublicNomineeDto(row),
    votesByCategory,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/**
 * Vote counts per category for the nominees matching `where` (a condition on
 * `nominees` or `votes`), keyed by nominee id. Nominees without votes are
 * left out.
 */
export async function countVotesByNominee(
  where: SQL | undefined,
  executor: DbReader = db
): Promise<Map<string, Record<string, number>>> {
  const rows = await executor
    .select({
      nomineeId: votes.nomineeId,
      categoryId: votes.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(votes)
    .innerJoin(nominees, eq(nominees.id, votes.nomineeId))
    .where(where)
    .groupBy(votes.nomineeId, votes.categoryId);
  const byNominee = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const counts = byNominee.get(row.nomineeId) ?? {};
    counts[row.categoryId] = row.count;
    byNominee.set(row.nomineeId, counts);
  }
  return byNominee;
}

/** All nominees of a session, oldest first. */
export async function listPublicNominees(
  sessionId: string,
  executor: DbReader = db
): Promise<PublicNomineeDto[]> {
  const rows = await executor
    .select()
    .from(nominees)
    .where(eq(nominees.sessionId, sessionId))
    .orderBy(asc(nominees.createdAt), asc(nominees.id));
  return rows.map(toPublicNomineeDto);
}

/** All nominees of a session with derived vote counts per category, oldest first. */
export async function listAdminNominees(
  sessionId: string,
  executor: DbReader = db
): Promise<AdminNomineeDto[]> {
  const rows = await executor
    .select()
    .from(nominees)
    .where(eq(nominees.sessionId, sessionId))
    .orderBy(asc(nominees.createdAt), asc(nominees.id));
  const counts = await countVotesByNominee(
    eq(nominees.sessionId, sessionId),
    executor
  );
  return rows.map((row) => toAdminNomineeDto(row, counts.get(row.id) ?? {}));
}

/** Nominations owned by a device in a session, oldest first. */
export async function listOwnedNominees(
  sessionId: string,
  ownerTokenHash: string
): Promise<PublicNomineeDto[]> {
  const rows = await db
    .select()
    .from(nominees)
    .where(
      and(
        eq(nominees.sessionId, sessionId),
        eq(nominees.ownerTokenHash, ownerTokenHash)
      )
    )
    .orderBy(asc(nominees.createdAt), asc(nominees.id));
  return rows.map(toPublicNomineeDto);
}

export function requireNomineeId(id: string): string {
  return requireUuid(id, "Nomination not found");
}
