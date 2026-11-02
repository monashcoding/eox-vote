import { and, asc, eq } from "drizzle-orm";
import { Stage } from "./api-types";
import { db, type DbReader, type DbTransaction } from "./db";
import { nominees, votes } from "./db/schema";
import { HttpError } from "./http";
import { getCurrentSessionId, syncSessionInTx } from "./session";
import { invalidatePublicState } from "./session/public-state";

const NOT_VOTING = "Voting is not open right now";

/** Nominee ids a device has voted for in one session, oldest vote first. */
export async function listDeviceVotes(
  sessionId: string,
  voterTokenHash: string,
  executor: DbReader = db
): Promise<string[]> {
  const rows = await executor
    .select({ nomineeId: votes.nomineeId })
    .from(votes)
    .innerJoin(nominees, eq(nominees.id, votes.nomineeId))
    .where(
      and(
        eq(nominees.sessionId, sessionId),
        eq(votes.voterTokenHash, voterTokenHash)
      )
    )
    .orderBy(asc(votes.createdAt), asc(votes.nomineeId));
  return rows.map((row) => row.nomineeId);
}

/**
 * Locks and syncs the current session, requires the voting stage and that the
 * nominee belongs to it. Returns the session id.
 */
async function requireVotableNominee(
  tx: DbTransaction,
  nomineeId: string
): Promise<string> {
  const sessionId = await getCurrentSessionId(tx);
  if (!sessionId) {
    throw new HttpError(409, NOT_VOTING);
  }
  const session = await syncSessionInTx(tx, sessionId);
  // Share lock: a concurrent nominee delete waits, so the vote insert cannot hit a missing FK.
  const [nominee] = await tx
    .select({ sessionId: nominees.sessionId })
    .from(nominees)
    .where(eq(nominees.id, nomineeId))
    .for("share");
  if (!nominee || nominee.sessionId !== sessionId) {
    throw new HttpError(404, "Nomination not found");
  }
  if (session.stage !== Stage.Voting) {
    throw new HttpError(409, NOT_VOTING);
  }
  return sessionId;
}

/** Idempotent: a second vote for the same nominee from the same device is a no-op. */
export async function castVote(
  nomineeId: string,
  voterTokenHash: string
): Promise<string[]> {
  const result = await db.transaction(async (tx) => {
    const sessionId = await requireVotableNominee(tx, nomineeId);
    await tx
      .insert(votes)
      .values({ nomineeId, voterTokenHash })
      .onConflictDoNothing();
    return await listDeviceVotes(sessionId, voterTokenHash, tx);
  });
  invalidatePublicState();
  return result;
}

export async function removeVote(
  nomineeId: string,
  voterTokenHash: string
): Promise<string[]> {
  const result = await db.transaction(async (tx) => {
    const sessionId = await requireVotableNominee(tx, nomineeId);
    await tx
      .delete(votes)
      .where(
        and(
          eq(votes.nomineeId, nomineeId),
          eq(votes.voterTokenHash, voterTokenHash)
        )
      );
    return await listDeviceVotes(sessionId, voterTokenHash, tx);
  });
  invalidatePublicState();
  return result;
}
