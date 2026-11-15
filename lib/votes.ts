import { and, asc, eq } from "drizzle-orm";
import { Stage, type VoteDto } from "./api-types";
import { lockSessionCategoryInTx } from "./categories";
import { db, type DbReader, type DbTransaction } from "./db";
import { nominees, votes } from "./db/schema";
import { HttpError } from "./http";
import { getCurrentSessionId, syncSessionInTx } from "./session";
import { invalidatePublicState } from "./session/public-state";

const NOT_VOTING = "Voting is not open right now";

/** A device's votes in one session, oldest vote first. */
export async function listDeviceVotes(
  sessionId: string,
  voterTokenHash: string,
  executor: DbReader = db
): Promise<VoteDto[]> {
  return await executor
    .select({ categoryId: votes.categoryId, nomineeId: votes.nomineeId })
    .from(votes)
    .innerJoin(nominees, eq(nominees.id, votes.nomineeId))
    .where(
      and(
        eq(nominees.sessionId, sessionId),
        eq(votes.voterTokenHash, voterTokenHash)
      )
    )
    .orderBy(asc(votes.createdAt), asc(votes.categoryId), asc(votes.nomineeId));
}

/**
 * Locks and syncs the current session, requires the voting stage and that the
 * category and the nominee both belong to it. Returns the session id.
 */
async function requireVotable(
  tx: DbTransaction,
  categoryId: string,
  nomineeId: string
): Promise<string> {
  const sessionId = await getCurrentSessionId(tx);
  if (!sessionId) {
    throw new HttpError(409, NOT_VOTING);
  }
  const session = await syncSessionInTx(tx, sessionId);
  // Share locks: a concurrent delete of either waits, so the vote insert cannot hit a missing FK.
  await lockSessionCategoryInTx(tx, sessionId, categoryId);
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

/** Idempotent: a second vote for the same nominee in the same category is a no-op. */
export async function castVote(
  categoryId: string,
  nomineeId: string,
  voterTokenHash: string
): Promise<VoteDto[]> {
  const result = await db.transaction(async (tx) => {
    const sessionId = await requireVotable(tx, categoryId, nomineeId);
    await tx
      .insert(votes)
      .values({ nomineeId, categoryId, voterTokenHash })
      .onConflictDoNothing();
    return await listDeviceVotes(sessionId, voterTokenHash, tx);
  });
  invalidatePublicState();
  return result;
}

export async function removeVote(
  categoryId: string,
  nomineeId: string,
  voterTokenHash: string
): Promise<VoteDto[]> {
  const result = await db.transaction(async (tx) => {
    const sessionId = await requireVotable(tx, categoryId, nomineeId);
    await tx
      .delete(votes)
      .where(
        and(
          eq(votes.nomineeId, nomineeId),
          eq(votes.categoryId, categoryId),
          eq(votes.voterTokenHash, voterTokenHash)
        )
      );
    return await listDeviceVotes(sessionId, voterTokenHash, tx);
  });
  invalidatePublicState();
  return result;
}
