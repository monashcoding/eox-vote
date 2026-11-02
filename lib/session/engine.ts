import { Stage, ControlAction } from "../api-types.ts";
import type { ControlRequest } from "../api-types.ts";

export class EngineError extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

export const MAX_TIMER_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface EngineSessionInput {
  stage: Stage;
  nominatingMinutes: number;
  votingMinutes: number;
  autoAdvance: boolean;
  timerEndsAt: number | Date | null;
  timerRemainingMs: number | null;
  startedAt?: number | Date | null;
  finishedAt?: number | Date | null;
  revealedCount?: number;
}

export interface EngineSessionOutput {
  stage: Stage;
  nominatingMinutes: number;
  votingMinutes: number;
  autoAdvance: boolean;
  timerEndsAt: number | null;
  timerRemainingMs: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  revealedCount: number;
}

function toEpoch(val: Date | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  return val.getTime();
}

function normalizeSession<T extends EngineSessionInput>(
  session: T
): T & EngineSessionOutput {
  return {
    ...session,
    timerEndsAt: toEpoch(session.timerEndsAt),
    timerRemainingMs: session.timerRemainingMs ?? null,
    startedAt: toEpoch(session.startedAt),
    finishedAt: toEpoch(session.finishedAt),
    revealedCount: session.revealedCount ?? 0,
  };
}

export function isTimedStage(stage: Stage): boolean {
  return stage === Stage.Nominating || stage === Stage.Voting;
}

export function canAutoAdvance(
  session: EngineSessionInput,
  now: number = Date.now()
): boolean {
  if (!session.autoAdvance) return false;
  if (!isTimedStage(session.stage)) return false;

  const timerEndsAt = toEpoch(session.timerEndsAt);
  const timerRemainingMs = session.timerRemainingMs;

  // Paused timers do not auto-advance
  if (timerRemainingMs !== null && timerRemainingMs !== undefined) {
    return false;
  }
  // No timer means no auto-advance
  if (timerEndsAt === null) {
    return false;
  }

  return timerEndsAt <= now;
}

export function applyAutoAdvance<T extends EngineSessionInput>(
  session: T,
  now: number = Date.now()
): T & EngineSessionOutput {
  if (!canAutoAdvance(session, now)) {
    return normalizeSession(session);
  }
  return applyControl(session, { action: ControlAction.Next }, now);
}

export function applyControl<T extends EngineSessionInput>(
  session: T,
  request: ControlRequest,
  now: number = Date.now()
): T & EngineSessionOutput {
  const normalized = normalizeSession(session);
  let { stage, startedAt, finishedAt, timerEndsAt, timerRemainingMs, revealedCount } =
    normalized;

  const timed = isTimedStage(stage);

  switch (request.action) {
    case ControlAction.Next: {
      switch (stage) {
        case Stage.Pending:
          stage = Stage.Nominating;
          startedAt = startedAt ?? now;
          timerEndsAt =
            normalized.nominatingMinutes > 0
              ? now + normalized.nominatingMinutes * 60 * 1000
              : null;
          timerRemainingMs = null;
          break;
        case Stage.Nominating:
          stage = Stage.Voting;
          timerEndsAt =
            normalized.votingMinutes > 0
              ? now + normalized.votingMinutes * 60 * 1000
              : null;
          timerRemainingMs = null;
          break;
        case Stage.Voting:
          stage = Stage.Results;
          timerEndsAt = null;
          timerRemainingMs = null;
          revealedCount = 0;
          break;
        case Stage.Results:
          stage = Stage.Finished;
          timerEndsAt = null;
          timerRemainingMs = null;
          finishedAt = now;
          break;
        case Stage.Finished:
          throw new EngineError("Cannot advance past finished stage");
        default:
          throw new EngineError(`Unknown stage: ${String(stage)}`);
      }
      break;
    }

    case ControlAction.Previous: {
      switch (stage) {
        case Stage.Finished:
          stage = Stage.Results;
          finishedAt = null;
          timerEndsAt = null;
          timerRemainingMs = null;
          break;
        case Stage.Results:
          stage = Stage.Voting;
          timerEndsAt = null;
          timerRemainingMs = null;
          break;
        case Stage.Voting:
          stage = Stage.Nominating;
          timerEndsAt = null;
          timerRemainingMs = null;
          break;
        case Stage.Nominating:
          stage = Stage.Pending;
          timerEndsAt = null;
          timerRemainingMs = null;
          break;
        case Stage.Pending:
          throw new EngineError("Cannot go back from pending stage");
        default:
          throw new EngineError(`Unknown stage: ${String(stage)}`);
      }
      break;
    }

    case ControlAction.Pause: {
      if (!timed) {
        throw new EngineError(
          `Timer controls are not available in stage "${stage}"`
        );
      }
      if (timerRemainingMs !== null) {
        throw new EngineError("Timer is already paused");
      }
      if (timerEndsAt === null) {
        throw new EngineError("Timer is not running");
      }
      timerRemainingMs = Math.max(0, timerEndsAt - now);
      timerEndsAt = null;
      break;
    }

    case ControlAction.Resume: {
      if (!timed) {
        throw new EngineError(
          `Timer controls are not available in stage "${stage}"`
        );
      }
      if (timerRemainingMs === null) {
        throw new EngineError("Timer is not paused");
      }
      timerEndsAt = now + timerRemainingMs;
      timerRemainingMs = null;
      break;
    }

    case ControlAction.AdjustTimer: {
      if (!timed) {
        throw new EngineError(
          `Timer controls are not available in stage "${stage}"`
        );
      }
      const delta = request.deltaMs;
      if (typeof delta !== "number" || !Number.isInteger(delta)) {
        throw new EngineError("Delta ms must be an integer");
      }
      if (Math.abs(delta) > MAX_TIMER_MS) {
        throw new EngineError("Timer adjustment must be at most 24 hours");
      }

      if (timerEndsAt !== null) {
        // running: endsAt = max(now, endsAt + delta)
        timerEndsAt = Math.max(now, timerEndsAt + delta);
        timerRemainingMs = null;
      } else if (timerRemainingMs !== null) {
        // paused: remaining = max(0, remaining + delta)
        timerRemainingMs = Math.max(0, timerRemainingMs + delta);
        timerEndsAt = null;
      } else {
        // none: delta > 0 starts a running timer, else error
        if (delta > 0) {
          timerEndsAt = now + delta;
          timerRemainingMs = null;
        } else {
          throw new EngineError("Cannot reduce timer when no timer is active");
        }
      }
      break;
    }

    case ControlAction.SetTimer: {
      if (!timed) {
        throw new EngineError(
          `Timer controls are not available in stage "${stage}"`
        );
      }

      if ("durationMs" in request) {
        const duration = request.durationMs;
        if (
          typeof duration !== "number" ||
          !Number.isInteger(duration) ||
          duration <= 0 ||
          duration > MAX_TIMER_MS
        ) {
          throw new EngineError(
            "Timer duration must be between 1 ms and 24 hours"
          );
        }
        timerEndsAt = now + duration;
        timerRemainingMs = null;
      } else if ("endsAt" in request) {
        const ends = request.endsAt;
        if (typeof ends !== "number" || !Number.isFinite(ends)) {
          throw new EngineError("Timer end time must be a valid number");
        }
        if (ends <= now) {
          throw new EngineError("Timer end time must be in the future");
        }
        if (ends > now + MAX_TIMER_MS) {
          throw new EngineError(
            "Timer end time cannot be more than 24 hours in the future"
          );
        }
        timerEndsAt = ends;
        timerRemainingMs = null;
      } else {
        throw new EngineError("Invalid setTimer payload");
      }
      break;
    }

    case ControlAction.ClearTimer: {
      if (!timed) {
        throw new EngineError(
          `Timer controls are not available in stage "${stage}"`
        );
      }
      timerEndsAt = null;
      timerRemainingMs = null;
      break;
    }

    default: {
      const exhaustiveCheck: never = request;
      throw new EngineError(`Unhandled control action: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  return {
    ...normalized,
    stage,
    startedAt,
    finishedAt,
    timerEndsAt,
    timerRemainingMs,
    revealedCount,
  };
}
