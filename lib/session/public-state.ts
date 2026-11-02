import {
  PublicNomineeDto,
  PublicResultsDto,
  PublicSessionDto,
  PublicStateDto,
  Stage,
} from "../api-types";
import { db } from "../db";
import { sessions } from "../db/schema";
import { HttpError } from "../http";
import { listAdminNominees, listPublicNominees } from "../nominees";
import { getCurrentSessionId, syncSessionInTx, toTimerDto } from "./index";
import { buildPodium, publicResults } from "./ranking";

export function toPublicSessionDto(
  session: typeof sessions.$inferSelect,
  nominees: PublicNomineeDto[],
  results: PublicResultsDto | null
): PublicSessionDto {
  return {
    id: session.id,
    name: session.name,
    stage: session.stage as Stage,
    timer: toTimerDto(session.timerEndsAt, session.timerRemainingMs),
    autoAdvance: session.autoAdvance,
    nominees,
    results,
  };
}

interface CachedPublicSession {
  cachedAt: number;
  generation: number;
  session: PublicSessionDto | null;
}

interface PendingRebuild {
  generation: number;
  promise: Promise<PublicSessionDto | null>;
}

const CACHE_TTL_MS = 1000;

let cachedState: CachedPublicSession | null = null;
let pendingRebuild: PendingRebuild | null = null;
/** Bumped by every invalidation; a rebuild started before a bump never fills the cache. */
let generation = 0;

export function invalidatePublicState(): void {
  generation++;
  cachedState = null;
}

async function buildPublicSession(): Promise<PublicSessionDto | null> {
  return await db.transaction(async (tx) => {
    const currentSessionId = await getCurrentSessionId(tx);
    if (!currentSessionId) {
      return null;
    }

    let sessionRow: typeof sessions.$inferSelect;
    try {
      sessionRow = await syncSessionInTx(tx, currentSessionId);
    } catch (err: unknown) {
      if (err instanceof HttpError && err.status === 404) {
        return null;
      }
      throw err;
    }

    const showNominees =
      sessionRow.stage === Stage.Nominating ||
      sessionRow.stage === Stage.Voting;
    const nominees = showNominees
      ? await listPublicNominees(sessionRow.id, tx)
      : [];
    const showResults =
      sessionRow.stage === Stage.Results ||
      sessionRow.stage === Stage.Finished;
    const results = showResults
      ? publicResults(
          sessionRow.stage as Stage,
          buildPodium(await listAdminNominees(sessionRow.id, tx)),
          sessionRow.revealedCount
        )
      : null;
    return toPublicSessionDto(sessionRow, nominees, results);
  });
}

/** Concurrent misses for the same generation share one rebuild. */
function rebuildPublicSession(): Promise<PublicSessionDto | null> {
  if (pendingRebuild && pendingRebuild.generation === generation) {
    return pendingRebuild.promise;
  }

  const startedGeneration = generation;
  const startedAt = Date.now();
  const entry: PendingRebuild = {
    generation: startedGeneration,
    promise: buildPublicSession()
      .then((session) => {
        if (startedGeneration === generation) {
          cachedState = {
            cachedAt: startedAt,
            generation: startedGeneration,
            session,
          };
        }
        return session;
      })
      .finally(() => {
        if (pendingRebuild === entry) {
          pendingRebuild = null;
        }
      }),
  };
  pendingRebuild = entry;
  return entry.promise;
}

export async function getPublicState(): Promise<PublicStateDto> {
  const cached = cachedState;
  if (
    cached &&
    cached.generation === generation &&
    Date.now() - cached.cachedAt < CACHE_TTL_MS
  ) {
    return { serverNow: Date.now(), session: cached.session };
  }

  const session = await rebuildPublicSession();
  return { serverNow: Date.now(), session };
}
