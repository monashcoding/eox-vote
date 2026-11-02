import {
  PublicNomineeDto,
  PublicSessionDto,
  PublicStateDto,
  Stage,
} from "../api-types";
import { sessions } from "../db/schema";
import { HttpError } from "../http";
import { listPublicNominees } from "../nominees";
import { getCurrentSessionId, syncSession, toTimerDto } from "./index";

export function toPublicSessionDto(
  session: typeof sessions.$inferSelect,
  nominees: PublicNomineeDto[]
): PublicSessionDto {
  return {
    id: session.id,
    name: session.name,
    stage: session.stage as Stage,
    timer: toTimerDto(session.timerEndsAt, session.timerRemainingMs),
    autoAdvance: session.autoAdvance,
    nominees,
  };
}

interface CachedPublicSession {
  cachedAt: number;
  session: PublicSessionDto | null;
}

let cachedState: CachedPublicSession | null = null;

export function invalidatePublicState(): void {
  cachedState = null;
}

export async function getPublicState(): Promise<PublicStateDto> {
  const now = Date.now();

  if (cachedState && now - cachedState.cachedAt < 1000) {
    return {
      serverNow: now,
      session: cachedState.session,
    };
  }

  const currentSessionId = await getCurrentSessionId();
  if (!currentSessionId) {
    cachedState = {
      cachedAt: now,
      session: null,
    };
    return {
      serverNow: now,
      session: null,
    };
  }

  let sessionRow: typeof sessions.$inferSelect | null = null;
  try {
    sessionRow = await syncSession(currentSessionId);
  } catch (err: unknown) {
    if (err instanceof HttpError && err.status === 404) {
      sessionRow = null;
    } else {
      throw err;
    }
  }

  let publicSession: PublicSessionDto | null = null;
  if (sessionRow) {
    const showNominees =
      sessionRow.stage === Stage.Nominating ||
      sessionRow.stage === Stage.Voting;
    const nominees = showNominees
      ? await listPublicNominees(sessionRow.id)
      : [];
    publicSession = toPublicSessionDto(sessionRow, nominees);
  }

  cachedState = {
    cachedAt: now,
    session: publicSession,
  };

  return {
    serverNow: now,
    session: publicSession,
  };
}
