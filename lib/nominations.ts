import { and, eq, sql } from "drizzle-orm";
import { Stage, type PublicNomineeDto } from "./api-types";
import { db, type DbTransaction } from "./db";
import { nomineePhotos, nominees } from "./db/schema";
import { HttpError } from "./http";
import { toPublicNomineeDto } from "./nominees";
import type { NomineeForm } from "./photos";
import { getCurrentSessionId, syncSessionInTx } from "./session";
import { invalidatePublicState } from "./session/public-state";

const NOT_NOMINATING = "Nominations are not open right now";

/** Locks and syncs the current session, requiring the nominating stage. */
async function requireNominatingSession(tx: DbTransaction): Promise<string> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    throw new HttpError(409, NOT_NOMINATING);
  }
  const session = await syncSessionInTx(tx, sessionId);
  if (session.stage !== Stage.Nominating) {
    throw new HttpError(409, NOT_NOMINATING);
  }
  return session.id;
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
