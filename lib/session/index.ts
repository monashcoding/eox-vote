import { eq, sql } from "drizzle-orm";
import {
  AdminNomineeDto,
  AdminSessionDetailDto,
  AdminSessionSummaryDto,
  ControlRequest,
  Stage,
  TimerDto,
} from "../api-types";
import { applyAutoAdvance, applyControl, canAutoAdvance } from "./engine";
import { buildPodium, clampRevealed } from "./ranking";
import { invalidatePublicState } from "./public-state";
import { db, type DbTransaction } from "../db";
import { appSettings, nominees, sessions, votes } from "../db/schema";
import { HttpError } from "../http";
import { listAdminNominees } from "../nominees";

export function toTimerDto(
  timerEndsAt: Date | null,
  timerRemainingMs: number | null
): TimerDto {
  return {
    endsAt: timerEndsAt ? timerEndsAt.getTime() : null,
    remainingMs: timerRemainingMs ?? null,
  };
}

export function toAdminSessionSummaryDto(
  session: typeof sessions.$inferSelect,
  currentSessionId: string | null,
  nomineeCount: number,
  voteCount: number
): AdminSessionSummaryDto {
  return {
    id: session.id,
    name: session.name,
    stage: session.stage as Stage,
    isCurrent: session.id === currentSessionId,
    nomineeCount,
    voteCount,
    createdAt: session.createdAt.getTime(),
    startedAt: session.startedAt ? session.startedAt.getTime() : null,
    finishedAt: session.finishedAt ? session.finishedAt.getTime() : null,
  };
}

export function toAdminSessionDetailDto(
  session: typeof sessions.$inferSelect,
  currentSessionId: string | null,
  adminNominees: AdminNomineeDto[]
): AdminSessionDetailDto {
  const podium = buildPodium(adminNominees);
  return {
    id: session.id,
    name: session.name,
    stage: session.stage as Stage,
    isCurrent: session.id === currentSessionId,
    nominatingMinutes: session.nominatingMinutes,
    votingMinutes: session.votingMinutes,
    autoAdvance: session.autoAdvance,
    timer: toTimerDto(session.timerEndsAt, session.timerRemainingMs),
    createdAt: session.createdAt.getTime(),
    startedAt: session.startedAt ? session.startedAt.getTime() : null,
    finishedAt: session.finishedAt ? session.finishedAt.getTime() : null,
    serverNow: Date.now(),
    nominees: adminNominees,
    revealedCount: clampRevealed(session.revealedCount, podium.length),
    totalRevealSteps: podium.length,
    podium,
  };
}

export async function getCurrentSessionId(): Promise<string | null> {
  const [settings] = await db
    .select({ currentSessionId: appSettings.currentSessionId })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  return settings?.currentSessionId ?? null;
}

export async function setCurrentSession(
  sessionId: string | null
): Promise<{ currentSessionId: string | null }> {
  if (sessionId !== null) {
    const [existing] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, "Session not found");
    }
  }

  await db
    .update(appSettings)
    .set({ currentSessionId: sessionId })
    .where(eq(appSettings.id, 1));

  invalidatePublicState();
  return { currentSessionId: sessionId };
}

export async function listAdminSessions(): Promise<{
  sessions: AdminSessionSummaryDto[];
  currentSessionId: string | null;
}> {
  const currentSessionId = await getCurrentSessionId();

  // Query sessions with aggregated counts of nominees and votes
  const rows = await db
    .select({
      session: sessions,
      nomineeCount: sql<number>`count(distinct ${nominees.id})::int`,
      voteCount: sql<number>`count(${votes.nomineeId})::int`,
    })
    .from(sessions)
    .leftJoin(nominees, eq(nominees.sessionId, sessions.id))
    .leftJoin(votes, eq(votes.nomineeId, nominees.id))
    .groupBy(sessions.id)
    .orderBy(sql`${sessions.createdAt} desc`);

  const summaryList = rows.map((r) =>
    toAdminSessionSummaryDto(
      r.session,
      currentSessionId,
      r.nomineeCount,
      r.voteCount
    )
  );

  return {
    sessions: summaryList,
    currentSessionId,
  };
}

/**
 * Locks the session row (`for update`) inside `tx`, applies any due
 * auto-advance and returns the fresh row. The lock is held until `tx` ends, so
 * callers can check the stage and mutate in the same transaction.
 */
export async function syncSessionInTx(
  tx: DbTransaction,
  id: string
): Promise<typeof sessions.$inferSelect> {
  const [session] = await tx
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .for("update");

  if (!session) {
    throw new HttpError(404, "Session not found");
  }

  const now = Date.now();
  let current = session;
  let changed = false;
  let iterations = 0;

  while (canAutoAdvance(current, now) && iterations < 5) {
    current = {
      ...current,
      ...applyAutoAdvance(current, now),
    };
    changed = true;
    iterations++;
  }

  if (!changed) {
    return session;
  }

  const [updated] = await tx
    .update(sessions)
    .set({
      stage: current.stage,
      startedAt: current.startedAt ? new Date(current.startedAt) : null,
      finishedAt: current.finishedAt ? new Date(current.finishedAt) : null,
      timerEndsAt: current.timerEndsAt ? new Date(current.timerEndsAt) : null,
      timerRemainingMs: current.timerRemainingMs,
      revealedCount: current.revealedCount,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, id))
    .returning();

  return updated;
}

export async function syncSession(
  id: string
): Promise<typeof sessions.$inferSelect> {
  return await db.transaction((tx) => syncSessionInTx(tx, id));
}

export async function applyAdminSessionControl(
  id: string,
  request: ControlRequest
): Promise<AdminSessionDetailDto> {
  const currentSessionId = await getCurrentSessionId();

  return await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .for("update");

    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    const now = Date.now();
    let current = session;
    let iterations = 0;

    // Auto-advance if expired before applying control
    while (canAutoAdvance(current, now) && iterations < 5) {
      current = {
        ...current,
        ...applyAutoAdvance(current, now),
      };
      iterations++;
    }

    const nextState = applyControl(
      current,
      request,
      now,
      buildPodium(await listAdminNominees(current.id)).length
    );

    const [updated] = await tx
      .update(sessions)
      .set({
        stage: nextState.stage,
        startedAt: nextState.startedAt ? new Date(nextState.startedAt) : null,
        finishedAt: nextState.finishedAt ? new Date(nextState.finishedAt) : null,
        timerEndsAt: nextState.timerEndsAt ? new Date(nextState.timerEndsAt) : null,
        timerRemainingMs: nextState.timerRemainingMs,
        revealedCount: nextState.revealedCount,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();

    invalidatePublicState();
    return toAdminSessionDetailDto(
      updated,
      currentSessionId,
      await listAdminNominees(updated.id)
    );
  });
}

export async function getAdminSessionDetail(
  id: string
): Promise<AdminSessionDetailDto> {
  const session = await syncSession(id);
  const currentSessionId = await getCurrentSessionId();
  return toAdminSessionDetailDto(
    session,
    currentSessionId,
    await listAdminNominees(session.id)
  );
}

export interface CreateSessionInput {
  name: string;
  nominatingMinutes?: number;
  votingMinutes?: number;
  autoAdvance?: boolean;
}

export async function createAdminSession(
  input: CreateSessionInput
): Promise<AdminSessionDetailDto> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new HttpError(400, "Name must be between 1 and 80 characters");
  }

  const [inserted] = await db
    .insert(sessions)
    .values({
      name,
      nominatingMinutes: input.nominatingMinutes ?? 30,
      votingMinutes: input.votingMinutes ?? 45,
      autoAdvance: input.autoAdvance ?? false,
    })
    .returning();

  invalidatePublicState();
  const currentSessionId = await getCurrentSessionId();
  return toAdminSessionDetailDto(inserted, currentSessionId, []);
}

export interface UpdateSessionInput {
  name?: string;
  nominatingMinutes?: number;
  votingMinutes?: number;
  autoAdvance?: boolean;
}

export async function updateAdminSession(
  id: string,
  input: UpdateSessionInput
): Promise<AdminSessionDetailDto> {
  const updates: Partial<typeof sessions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 80) {
      throw new HttpError(400, "Name must be between 1 and 80 characters");
    }
    updates.name = name;
  }

  if (input.nominatingMinutes !== undefined) {
    if (input.nominatingMinutes < 0 || input.nominatingMinutes > 600) {
      throw new HttpError(400, "Nominating minutes must be between 0 and 600");
    }
    updates.nominatingMinutes = input.nominatingMinutes;
  }

  if (input.votingMinutes !== undefined) {
    if (input.votingMinutes < 0 || input.votingMinutes > 600) {
      throw new HttpError(400, "Voting minutes must be between 0 and 600");
    }
    updates.votingMinutes = input.votingMinutes;
  }

  if (input.autoAdvance !== undefined) {
    updates.autoAdvance = input.autoAdvance;
  }

  const [updated] = await db
    .update(sessions)
    .set(updates)
    .where(eq(sessions.id, id))
    .returning();

  if (!updated) {
    throw new HttpError(404, "Session not found");
  }

  invalidatePublicState();
  const currentSessionId = await getCurrentSessionId();
  return toAdminSessionDetailDto(
    updated,
    currentSessionId,
    await listAdminNominees(updated.id)
  );
}

export async function deleteAdminSession(id: string): Promise<void> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.id, id))
    .returning({ id: sessions.id });

  invalidatePublicState();
  if (deleted.length === 0) {
    throw new HttpError(404, "Session not found");
  }
}
