import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Stage, ControlAction } from "../api-types.ts";
import {
  applyControl,
  canAutoAdvance,
  applyAutoAdvance,
  EngineError,
  MAX_TIMER_MS,
  type EngineSessionInput,
} from "./engine.ts";

function createMockSession(
  overrides: Partial<EngineSessionInput> = {}
): EngineSessionInput {
  return {
    stage: Stage.Pending,
    nominatingMinutes: 30,
    votingMinutes: 45,
    autoAdvance: false,
    timerEndsAt: null,
    timerRemainingMs: null,
    startedAt: null,
    finishedAt: null,
    revealedCount: 0,
    ...overrides,
  };
}

describe("Session Engine: Next transition", () => {
  it("advances pending -> nominating, sets startedAt and timer when nominatingMinutes > 0", () => {
    const now = 1_000_000;
    const session = createMockSession({ nominatingMinutes: 20 });
    const next = applyControl(session, { action: ControlAction.Next }, now);

    assert.equal(next.stage, Stage.Nominating);
    assert.equal(next.startedAt, now);
    assert.equal(next.timerEndsAt, now + 20 * 60 * 1000);
    assert.equal(next.timerRemainingMs, null);
  });

  it("preserves startedAt if already set when moving to nominating", () => {
    const now = 2_000_000;
    const initialStartedAt = 1_000_000;
    const session = createMockSession({ startedAt: initialStartedAt });
    const next = applyControl(session, { action: ControlAction.Next }, now);

    assert.equal(next.stage, Stage.Nominating);
    assert.equal(next.startedAt, initialStartedAt);
  });

  it("advances pending -> nominating without timer if nominatingMinutes == 0", () => {
    const now = 1_000_000;
    const session = createMockSession({ nominatingMinutes: 0 });
    const next = applyControl(session, { action: ControlAction.Next }, now);

    assert.equal(next.stage, Stage.Nominating);
    assert.equal(next.timerEndsAt, null);
    assert.equal(next.timerRemainingMs, null);
  });

  it("advances nominating -> voting with voting timer if votingMinutes > 0", () => {
    const now = 3_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      votingMinutes: 15,
      timerEndsAt: now + 5000,
    });
    const next = applyControl(session, { action: ControlAction.Next }, now);

    assert.equal(next.stage, Stage.Voting);
    assert.equal(next.timerEndsAt, now + 15 * 60 * 1000);
    assert.equal(next.timerRemainingMs, null);
  });

  it("advances nominating -> voting without timer if votingMinutes == 0", () => {
    const now = 3_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      votingMinutes: 0,
    });
    const next = applyControl(session, { action: ControlAction.Next }, now);

    assert.equal(next.stage, Stage.Voting);
    assert.equal(next.timerEndsAt, null);
    assert.equal(next.timerRemainingMs, null);
  });

  it("advances voting -> results, clears timer and resets revealedCount to 0", () => {
    const now = 4_000_000;
    const session = createMockSession({
      stage: Stage.Voting,
      timerEndsAt: now + 10000,
      revealedCount: 5,
    });
    const next = applyControl(session, { action: ControlAction.Next }, now);

    assert.equal(next.stage, Stage.Results);
    assert.equal(next.timerEndsAt, null);
    assert.equal(next.timerRemainingMs, null);
    assert.equal(next.revealedCount, 0);
  });

  it("advances results -> finished, sets finishedAt and clears timer", () => {
    const now = 5_000_000;
    const session = createMockSession({
      stage: Stage.Results,
      revealedCount: 3,
    });
    const next = applyControl(session, { action: ControlAction.Next }, now);

    assert.equal(next.stage, Stage.Finished);
    assert.equal(next.finishedAt, now);
    assert.equal(next.timerEndsAt, null);
    assert.equal(next.timerRemainingMs, null);
  });

  it("throws EngineError when trying to advance past finished", () => {
    const session = createMockSession({ stage: Stage.Finished });
    assert.throws(
      () => applyControl(session, { action: ControlAction.Next }),
      EngineError
    );
  });
});

describe("Session Engine: Previous transition", () => {
  it("moves finished -> results, clears finishedAt and clears timer", () => {
    const now = 6_000_000;
    const session = createMockSession({
      stage: Stage.Finished,
      finishedAt: now,
    });
    const prev = applyControl(session, { action: ControlAction.Previous });

    assert.equal(prev.stage, Stage.Results);
    assert.equal(prev.finishedAt, null);
    assert.equal(prev.timerEndsAt, null);
    assert.equal(prev.timerRemainingMs, null);
  });

  it("moves results -> voting, clears timer", () => {
    const session = createMockSession({
      stage: Stage.Results,
      revealedCount: 2,
    });
    const prev = applyControl(session, { action: ControlAction.Previous });

    assert.equal(prev.stage, Stage.Voting);
    assert.equal(prev.timerEndsAt, null);
    assert.equal(prev.timerRemainingMs, null);
  });

  it("moves voting -> nominating, clears timer", () => {
    const session = createMockSession({
      stage: Stage.Voting,
      timerEndsAt: 12345,
    });
    const prev = applyControl(session, { action: ControlAction.Previous });

    assert.equal(prev.stage, Stage.Nominating);
    assert.equal(prev.timerEndsAt, null);
    assert.equal(prev.timerRemainingMs, null);
  });

  it("moves nominating -> pending, clears timer and preserves startedAt", () => {
    const startedAt = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      startedAt,
      timerEndsAt: 2_000_000,
    });
    const prev = applyControl(session, { action: ControlAction.Previous });

    assert.equal(prev.stage, Stage.Pending);
    assert.equal(prev.startedAt, startedAt);
    assert.equal(prev.timerEndsAt, null);
    assert.equal(prev.timerRemainingMs, null);
  });

  it("throws EngineError when trying to go back from pending", () => {
    const session = createMockSession({ stage: Stage.Pending });
    assert.throws(
      () => applyControl(session, { action: ControlAction.Previous }),
      EngineError
    );
  });
});

describe("Session Engine: Pause and Resume", () => {
  it("pauses a running timer correctly", () => {
    const now = 1_000_000;
    const endsAt = 1_060_000; // 60 seconds left
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: endsAt,
    });

    const res = applyControl(session, { action: ControlAction.Pause }, now);
    assert.equal(res.timerEndsAt, null);
    assert.equal(res.timerRemainingMs, 60_000);
  });

  it("clamps remainingMs to 0 if paused when timer is already expired", () => {
    const now = 1_100_000;
    const endsAt = 1_060_000; // expired 40s ago
    const session = createMockSession({
      stage: Stage.Voting,
      timerEndsAt: endsAt,
    });

    const res = applyControl(session, { action: ControlAction.Pause }, now);
    assert.equal(res.timerEndsAt, null);
    assert.equal(res.timerRemainingMs, 0);
  });

  it("throws EngineError when pausing a timer that is already paused", () => {
    const session = createMockSession({
      stage: Stage.Nominating,
      timerRemainingMs: 30_000,
    });
    assert.throws(
      () => applyControl(session, { action: ControlAction.Pause }),
      EngineError
    );
  });

  it("throws EngineError when pausing with no active timer", () => {
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: null,
      timerRemainingMs: null,
    });
    assert.throws(
      () => applyControl(session, { action: ControlAction.Pause }),
      EngineError
    );
  });

  it("resumes a paused timer correctly", () => {
    const now = 2_000_000;
    const remainingMs = 45_000;
    const session = createMockSession({
      stage: Stage.Voting,
      timerRemainingMs: remainingMs,
    });

    const res = applyControl(session, { action: ControlAction.Resume }, now);
    assert.equal(res.timerEndsAt, now + remainingMs);
    assert.equal(res.timerRemainingMs, null);
  });

  it("throws EngineError when resuming a timer that is not paused", () => {
    const session = createMockSession({
      stage: Stage.Voting,
      timerEndsAt: 2_050_000,
    });
    assert.throws(
      () => applyControl(session, { action: ControlAction.Resume }),
      EngineError
    );
  });

  it("throws EngineError when pause/resume called in non-timed stage", () => {
    const pendingSession = createMockSession({ stage: Stage.Pending });
    assert.throws(
      () => applyControl(pendingSession, { action: ControlAction.Pause }),
      EngineError
    );
    assert.throws(
      () => applyControl(pendingSession, { action: ControlAction.Resume }),
      EngineError
    );

    const resultsSession = createMockSession({ stage: Stage.Results });
    assert.throws(
      () => applyControl(resultsSession, { action: ControlAction.Pause }),
      EngineError
    );

    const finishedSession = createMockSession({ stage: Stage.Finished });
    assert.throws(
      () => applyControl(finishedSession, { action: ControlAction.Resume }),
      EngineError
    );
  });
});

describe("Session Engine: AdjustTimer", () => {
  it("adjusts a running timer forward", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: 1_030_000,
    });

    const res = applyControl(
      session,
      { action: ControlAction.AdjustTimer, deltaMs: 60_000 },
      now
    );
    assert.equal(res.timerEndsAt, 1_090_000);
    assert.equal(res.timerRemainingMs, null);
  });

  it("clamps running timer to now when reduced past now", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: 1_030_000,
    });

    const res = applyControl(
      session,
      { action: ControlAction.AdjustTimer, deltaMs: -50_000 },
      now
    );
    assert.equal(res.timerEndsAt, now);
  });

  it("adjusts a paused timer forward", () => {
    const session = createMockSession({
      stage: Stage.Voting,
      timerRemainingMs: 30_000,
    });

    const res = applyControl(session, {
      action: ControlAction.AdjustTimer,
      deltaMs: 20_000,
    });
    assert.equal(res.timerRemainingMs, 50_000);
    assert.equal(res.timerEndsAt, null);
  });

  it("clamps a paused timer to 0 when reduced below 0", () => {
    const session = createMockSession({
      stage: Stage.Voting,
      timerRemainingMs: 15_000,
    });

    const res = applyControl(session, {
      action: ControlAction.AdjustTimer,
      deltaMs: -30_000,
    });
    assert.equal(res.timerRemainingMs, 0);
  });

  it("starts a running timer when deltaMs > 0 and no timer active", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: null,
      timerRemainingMs: null,
    });

    const res = applyControl(
      session,
      { action: ControlAction.AdjustTimer, deltaMs: 60_000 },
      now
    );
    assert.equal(res.timerEndsAt, now + 60_000);
    assert.equal(res.timerRemainingMs, null);
  });

  it("throws EngineError when deltaMs <= 0 and no timer active", () => {
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: null,
      timerRemainingMs: null,
    });

    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.AdjustTimer,
          deltaMs: -1000,
        }),
      EngineError
    );
    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.AdjustTimer,
          deltaMs: 0,
        }),
      EngineError
    );
  });

  it("validates deltaMs <= 24h limit", () => {
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: 1000,
    });

    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.AdjustTimer,
          deltaMs: MAX_TIMER_MS + 1,
        }),
      EngineError
    );
    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.AdjustTimer,
          deltaMs: -(MAX_TIMER_MS + 1),
        }),
      EngineError
    );
  });

  it("throws EngineError when adjustTimer used in non-timed stage", () => {
    const session = createMockSession({ stage: Stage.Results });
    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.AdjustTimer,
          deltaMs: 60_000,
        }),
      EngineError
    );
  });
});

describe("Session Engine: SetTimer", () => {
  it("sets timer with valid durationMs", () => {
    const now = 1_000_000;
    const session = createMockSession({ stage: Stage.Nominating });

    const res = applyControl(
      session,
      { action: ControlAction.SetTimer, durationMs: 300_000 },
      now
    );
    assert.equal(res.timerEndsAt, now + 300_000);
    assert.equal(res.timerRemainingMs, null);
  });

  it("throws EngineError for non-positive or >24h durationMs", () => {
    const session = createMockSession({ stage: Stage.Voting });

    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.SetTimer,
          durationMs: 0,
        }),
      EngineError
    );
    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.SetTimer,
          durationMs: -5000,
        }),
      EngineError
    );
    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.SetTimer,
          durationMs: MAX_TIMER_MS + 1,
        }),
      EngineError
    );
  });

  it("sets timer with valid endsAt timestamp in the future", () => {
    const now = 1_000_000;
    const endsAt = now + 600_000;
    const session = createMockSession({ stage: Stage.Voting });

    const res = applyControl(
      session,
      { action: ControlAction.SetTimer, endsAt },
      now
    );
    assert.equal(res.timerEndsAt, endsAt);
    assert.equal(res.timerRemainingMs, null);
  });

  it("throws EngineError for endsAt in the past or now", () => {
    const now = 1_000_000;
    const session = createMockSession({ stage: Stage.Voting });

    assert.throws(
      () =>
        applyControl(session, { action: ControlAction.SetTimer, endsAt: now }, now),
      EngineError
    );
    assert.throws(
      () =>
        applyControl(
          session,
          { action: ControlAction.SetTimer, endsAt: now - 1000 },
          now
        ),
      EngineError
    );
  });

  it("throws EngineError for endsAt more than 24h into the future", () => {
    const now = 1_000_000;
    const session = createMockSession({ stage: Stage.Voting });

    assert.throws(
      () =>
        applyControl(
          session,
          { action: ControlAction.SetTimer, endsAt: now + MAX_TIMER_MS + 100 },
          now
        ),
      EngineError
    );
  });

  it("throws EngineError when setTimer used in non-timed stage", () => {
    const session = createMockSession({ stage: Stage.Finished });
    assert.throws(
      () =>
        applyControl(session, {
          action: ControlAction.SetTimer,
          durationMs: 60_000,
        }),
      EngineError
    );
  });
});

describe("Session Engine: ClearTimer", () => {
  it("clears a running timer", () => {
    const session = createMockSession({
      stage: Stage.Nominating,
      timerEndsAt: 1_234_567,
    });
    const res = applyControl(session, { action: ControlAction.ClearTimer });
    assert.equal(res.timerEndsAt, null);
    assert.equal(res.timerRemainingMs, null);
  });

  it("clears a paused timer", () => {
    const session = createMockSession({
      stage: Stage.Voting,
      timerRemainingMs: 50_000,
    });
    const res = applyControl(session, { action: ControlAction.ClearTimer });
    assert.equal(res.timerEndsAt, null);
    assert.equal(res.timerRemainingMs, null);
  });

  it("is a no-op if no timer was set", () => {
    const session = createMockSession({
      stage: Stage.Voting,
      timerEndsAt: null,
      timerRemainingMs: null,
    });
    const res = applyControl(session, { action: ControlAction.ClearTimer });
    assert.equal(res.timerEndsAt, null);
    assert.equal(res.timerRemainingMs, null);
  });

  it("throws EngineError when clearTimer used in non-timed stage", () => {
    const session = createMockSession({ stage: Stage.Pending });
    assert.throws(
      () => applyControl(session, { action: ControlAction.ClearTimer }),
      EngineError
    );
  });
});

describe("Session Engine: Auto-advance", () => {
  it("canAutoAdvance returns true when autoAdvance=true, timed stage, running timer, endsAt <= now", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      autoAdvance: true,
      timerEndsAt: now - 500,
    });
    assert.equal(canAutoAdvance(session, now), true);
  });

  it("canAutoAdvance returns false when autoAdvance=false", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      autoAdvance: false,
      timerEndsAt: now - 500,
    });
    assert.equal(canAutoAdvance(session, now), false);
  });

  it("canAutoAdvance returns false when timer is still running (endsAt > now)", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      autoAdvance: true,
      timerEndsAt: now + 5000,
    });
    assert.equal(canAutoAdvance(session, now), false);
  });

  it("canAutoAdvance returns false when timer is paused", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      autoAdvance: true,
      timerEndsAt: null,
      timerRemainingMs: 5000,
    });
    assert.equal(canAutoAdvance(session, now), false);
  });

  it("canAutoAdvance returns false when no timer exists", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      autoAdvance: true,
      timerEndsAt: null,
      timerRemainingMs: null,
    });
    assert.equal(canAutoAdvance(session, now), false);
  });

  it("canAutoAdvance returns false in non-timed stages even if autoAdvance is true", () => {
    const now = 1_000_000;
    const pendingSession = createMockSession({
      stage: Stage.Pending,
      autoAdvance: true,
      timerEndsAt: now - 100,
    });
    assert.equal(canAutoAdvance(pendingSession, now), false);

    const resultsSession = createMockSession({
      stage: Stage.Results,
      autoAdvance: true,
      timerEndsAt: now - 100,
    });
    assert.equal(canAutoAdvance(resultsSession, now), false);

    const finishedSession = createMockSession({
      stage: Stage.Finished,
      autoAdvance: true,
      timerEndsAt: now - 100,
    });
    assert.equal(canAutoAdvance(finishedSession, now), false);
  });

  it("applyAutoAdvance transitions to next stage when eligible", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      votingMinutes: 45,
      autoAdvance: true,
      timerEndsAt: now - 10,
    });

    const res = applyAutoAdvance(session, now);
    assert.equal(res.stage, Stage.Voting);
    assert.equal(res.timerEndsAt, now + 45 * 60 * 1000);
  });

  it("applyAutoAdvance returns unchanged session when not eligible", () => {
    const now = 1_000_000;
    const session = createMockSession({
      stage: Stage.Nominating,
      autoAdvance: false,
      timerEndsAt: now - 10,
    });

    const res = applyAutoAdvance(session, now);
    assert.equal(res.stage, Stage.Nominating);
  });
});

describe("Session Engine: revealNext and hideLast", () => {
  const now = 5_000_000;

  it("revealNext increments revealedCount up to totalRevealSteps", () => {
    const session = createMockSession({ stage: Stage.Results, revealedCount: 0 });
    const one = applyControl(session, { action: ControlAction.RevealNext }, now, 3);
    assert.equal(one.revealedCount, 1);
    const two = applyControl(one, { action: ControlAction.RevealNext }, now, 3);
    assert.equal(two.revealedCount, 2);
    const three = applyControl(two, { action: ControlAction.RevealNext }, now, 3);
    assert.equal(three.revealedCount, 3);
  });

  it("revealNext at totalRevealSteps is an EngineError (409)", () => {
    const session = createMockSession({ stage: Stage.Results, revealedCount: 3 });
    assert.throws(
      () => applyControl(session, { action: ControlAction.RevealNext }, now, 3),
      (err: unknown) => err instanceof EngineError && err.status === 409
    );
  });

  it("revealNext with no steps (totalRevealSteps = 0) is an EngineError", () => {
    const session = createMockSession({ stage: Stage.Results });
    assert.throws(
      () => applyControl(session, { action: ControlAction.RevealNext }, now),
      EngineError
    );
  });

  it("hideLast decrements revealedCount", () => {
    const session = createMockSession({ stage: Stage.Results, revealedCount: 2 });
    const res = applyControl(session, { action: ControlAction.HideLast }, now, 3);
    assert.equal(res.revealedCount, 1);
  });

  it("hideLast at 0 is an EngineError (409)", () => {
    const session = createMockSession({ stage: Stage.Results, revealedCount: 0 });
    assert.throws(
      () => applyControl(session, { action: ControlAction.HideLast }, now, 3),
      (err: unknown) => err instanceof EngineError && err.status === 409
    );
  });

  it("hideLast drops a stale counter above the total to total - 1", () => {
    const session = createMockSession({ stage: Stage.Results, revealedCount: 5 });
    const res = applyControl(session, { action: ControlAction.HideLast }, now, 2);
    assert.equal(res.revealedCount, 1);
  });

  it("both actions are rejected outside the results stage", () => {
    for (const stage of [
      Stage.Pending,
      Stage.Nominating,
      Stage.Voting,
      Stage.Finished,
    ]) {
      const session = createMockSession({ stage, revealedCount: 1 });
      assert.throws(
        () => applyControl(session, { action: ControlAction.RevealNext }, now, 3),
        EngineError
      );
      assert.throws(
        () => applyControl(session, { action: ControlAction.HideLast }, now, 3),
        EngineError
      );
    }
  });
});
