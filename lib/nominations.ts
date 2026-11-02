import { and, eq, sql } from "drizzle-orm";
import { Stage, type AdminNomineeDto, type PublicNomineeDto } from "./api-types";
import { db, type DbReader, type DbTransaction } from "./db";
import { nomineePhotos, nominees, sessions, votes } from "./db/schema";
import { HttpError } from "./http";
import { toAdminNomineeDto, toPublicNomineeDto } from "./nominees";
import { nominationLimitError } from "./nomination-limits";
import type { NomineeForm } from "./photos";
import { getCurrentSessionId, syncSessionInTx } from "./session";
import { invalidatePublicState } from "./session/public-state";

const NOT_NOMINATING = "Nominations are not open right now";

/** Locks and syncs the current session, requiring the nominating stage. */
async function requireNominatingSession(tx: DbTransaction): Promise<string> {
  const sessionId = await getCurrentSessionId(tx);
  if (!sessionId) {
    throw new HttpError(409, NOT_NOMINATING);
  }
  const session = await syncSessionInTx(tx, sessionId);
  if (session.stage !== Stage.Nominating) {
    throw new HttpError(409, NOT_NOMINATING);
  }
  return session.id;
}

/** Throws 409 when the device or the session has reached its nomination cap. */
async function assertUnderNominationLimits(
  executor: DbReader,
  sessionId: string,
  ownerTokenHash: string
): Promise<void> {
  const [counts] = await executor
    .select({
      session: sql<number>`count(*)::int`,
      device: sql<number>`(count(*) filter (where ${nominees.ownerTokenHash} = ${ownerTokenHash}))::int`,
    })
    .from(nominees)
    .where(eq(nominees.sessionId, sessionId));
  const message = nominationLimitError(counts.device, counts.session);
  if (message) {
    throw new HttpError(409, message);
  }
}

/**
 * Cheap unlocked pre-check, run before an upload body is read so closed
 * stages, full sessions and other devices' entries never cost a buffered
 * body. The locked transaction repeats every check, so a stale answer here is
 * harmless. Without `nomineeId` it checks a new nomination, with one an edit.
 */
export async function assertCanNominate(
  ownerTokenHash: string,
  nomineeId?: string
): Promise<void> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    throw new HttpError(409, NOT_NOMINATING);
  }
  const [session] = await db
    .select({ stage: sessions.stage })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (session?.stage !== Stage.Nominating) {
    throw new HttpError(409, NOT_NOMINATING);
  }
  if (nomineeId === undefined) {
    await assertUnderNominationLimits(db, sessionId, ownerTokenHash);
    return;
  }
  const [existing] = await db
    .select({
      sessionId: nominees.sessionId,
      ownerTokenHash: nominees.ownerTokenHash,
    })
    .from(nominees)
    .where(eq(nominees.id, nomineeId))
    .limit(1);
  if (!existing || existing.sessionId !== sessionId) {
    throw new HttpError(404, "Nomination not found");
  }
  if (existing.ownerTokenHash !== ownerTokenHash) {
    throw new HttpError(403, "You can only edit your own nominations");
  }
}

export async function createNomination(
  ownerTokenHash: string,
  form: NomineeForm
): Promise<PublicNomineeDto> {
  if (!form.firstName || !form.lastName) {
    throw new HttpError(400, "First name and last name are required");
  }
  const { firstName, lastName, photo } = form;
  if (!photo) {
    throw new HttpError(400, "A costume photo is required");
  }

  const created = await db.transaction(async (tx) => {
    const sessionId = await requireNominatingSession(tx);
    // The session row lock serialises creates, so the counts cannot race.
    await assertUnderNominationLimits(tx, sessionId, ownerTokenHash);
    const [row] = await tx
      .insert(nominees)
      .values({ sessionId, firstName, lastName, ownerTokenHash })
      .returning();
    await tx.insert(nomineePhotos).values({
      nomineeId: row.id,
      contentType: photo.contentType,
      data: photo.data,
    });
    return row;
  });

  invalidatePublicState();
  return toPublicNomineeDto(created);
}

export async function updateOwnNomination(
  nomineeId: string,
  ownerTokenHash: string,
  form: NomineeForm
): Promise<PublicNomineeDto> {
  const updated = await db.transaction(async (tx) => {
    const sessionId = await requireNominatingSession(tx);
    const [existing] = await tx
      .select()
      .from(nominees)
      .where(eq(nominees.id, nomineeId))
      .for("update");
    if (!existing || existing.sessionId !== sessionId) {
      throw new HttpError(404, "Nomination not found");
    }
    if (existing.ownerTokenHash !== ownerTokenHash) {
      throw new HttpError(403, "You can only edit your own nominations");
    }
    return await applyNomineeUpdate(tx, nomineeId, form);
  });

  invalidatePublicState();
  return toPublicNomineeDto(updated);
}

export async function deleteOwnNomination(
  nomineeId: string,
  ownerTokenHash: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const sessionId = await requireNominatingSession(tx);
    const [existing] = await tx
      .select()
      .from(nominees)
      .where(eq(nominees.id, nomineeId))
      .for("update");
    if (!existing || existing.sessionId !== sessionId) {
      throw new HttpError(404, "Nomination not found");
    }
    if (existing.ownerTokenHash !== ownerTokenHash) {
      throw new HttpError(403, "You can only delete your own nominations");
    }
    await tx
      .delete(nominees)
      .where(
        and(
          eq(nominees.id, nomineeId),
          eq(nominees.ownerTokenHash, ownerTokenHash)
        )
      );
  });

  invalidatePublicState();
}

/**
 * Applies the present fields of `form` to a nominee row and returns the new
 * row. A photo replacement bumps `photo_version`. Shared by owner and admin
 * edits; the caller has already done the authorisation and stage checks.
 */
export async function applyNomineeUpdate(
  tx: DbTransaction,
  nomineeId: string,
  form: NomineeForm
): Promise<typeof nominees.$inferSelect> {
  const [row] = await tx
    .update(nominees)
    .set({
      ...(form.firstName !== undefined && { firstName: form.firstName }),
      ...(form.lastName !== undefined && { lastName: form.lastName }),
      ...(form.photo && { photoVersion: sql`${nominees.photoVersion} + 1` }),
      updatedAt: new Date(),
    })
    .where(eq(nominees.id, nomineeId))
    .returning();
  if (!row) {
    throw new HttpError(404, "Nomination not found");
  }
  if (form.photo) {
    await tx
      .update(nomineePhotos)
      .set({
        contentType: form.photo.contentType,
        data: form.photo.data,
        updatedAt: new Date(),
      })
      .where(eq(nomineePhotos.nomineeId, nomineeId));
  }
  return row;
}

/** Admin edit: any stage, no ownership check. Returns the DTO with its derived vote count. */
export async function updateNomineeAsAdmin(
  nomineeId: string,
  form: NomineeForm
): Promise<AdminNomineeDto> {
  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: nominees.id })
      .from(nominees)
      .where(eq(nominees.id, nomineeId))
      .for("update");
    if (!existing) {
      throw new HttpError(404, "Nomination not found");
    }
    return await applyNomineeUpdate(tx, nomineeId, form);
  });

  const [{ voteCount }] = await db
    .select({ voteCount: sql<number>`count(*)::int` })
    .from(votes)
    .where(eq(votes.nomineeId, nomineeId));

  invalidatePublicState();
  return toAdminNomineeDto(updated, voteCount);
}

/** Admin delete: any stage, no ownership check. Votes and photo cascade. */
export async function deleteNomineeAsAdmin(nomineeId: string): Promise<void> {
  const deleted = await db
    .delete(nominees)
    .where(eq(nominees.id, nomineeId))
    .returning({ id: nominees.id });
  if (deleted.length === 0) {
    throw new HttpError(404, "Nomination not found");
  }
  invalidatePublicState();
}
