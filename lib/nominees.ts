import { and, asc, eq, sql } from "drizzle-orm";
import type { AdminNomineeDto, PublicNomineeDto } from "./api-types";
import { db, type DbReader } from "./db";
import { HttpError } from "./http";
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
  voteCount: number
): AdminNomineeDto {
  return {
    ...toPublicNomineeDto(row),
    votes: voteCount,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
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

/** All nominees of a session with derived vote counts, oldest first. */
export async function listAdminNominees(
  sessionId: string,
  executor: DbReader = db
): Promise<AdminNomineeDto[]> {
  const rows = await executor
    .select({
      nominee: nominees,
      voteCount: sql<number>`count(${votes.nomineeId})::int`,
    })
    .from(nominees)
    .leftJoin(votes, eq(votes.nomineeId, nominees.id))
    .where(eq(nominees.sessionId, sessionId))
    .groupBy(nominees.id)
    .orderBy(asc(nominees.createdAt), asc(nominees.id));
  return rows.map((r) => toAdminNomineeDto(r.nominee, r.voteCount));
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids that are not UUIDs can never match a row; report 404 instead of a DB error. */
export function requireNomineeId(id: string): string {
  if (!UUID_PATTERN.test(id)) {
    throw new HttpError(404, "Nomination not found");
  }
  return id;
}
