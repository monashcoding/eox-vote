import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOMINATION_RETENTION_DAYS,
  nominationRetentionCutoff,
} from "./retention.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-03T12:00:00.000Z");

/** Mirrors the purge's `created_at < cutoff`. */
function isExpired(createdAt: Date): boolean {
  return createdAt < nominationRetentionCutoff(NOW);
}

describe("nominationRetentionCutoff", () => {
  it("is exactly 30 days before now", () => {
    assert.equal(NOMINATION_RETENTION_DAYS, 30);
    assert.equal(
      nominationRetentionCutoff(NOW).toISOString(),
      "2026-10-04T12:00:00.000Z"
    );
  });

  it("keeps a nomination submitted just under 30 days ago", () => {
    assert.equal(isExpired(new Date(NOW.getTime() - 30 * DAY_MS + 1)), false);
  });

  it("keeps a nomination submitted exactly 30 days ago", () => {
    assert.equal(isExpired(new Date(NOW.getTime() - 30 * DAY_MS)), false);
  });

  it("deletes a nomination submitted just over 30 days ago", () => {
    assert.equal(isExpired(new Date(NOW.getTime() - 30 * DAY_MS - 1)), true);
  });

  it("does not mutate the date it is given", () => {
    const now = new Date(NOW);
    nominationRetentionCutoff(now);
    assert.equal(now.getTime(), NOW.getTime());
  });
});
