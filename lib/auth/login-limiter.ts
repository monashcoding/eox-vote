/**
 * In-process counter of admin login attempts that have not succeeded. After
 * `maxFailures` of them inside `windowMs` a key is locked for `lockoutMs`.
 * Counts reset when the server restarts.
 */
export interface LoginLimiterOptions {
  maxFailures: number;
  windowMs: number;
  lockoutMs: number;
}

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

export class LoginLimiter {
  private readonly entries = new Map<string, Entry>();

  private readonly options: LoginLimiterOptions;

  constructor(options: LoginLimiterOptions) {
    this.options = options;
  }

  /** Milliseconds until `key` unlocks, or 0 when it is not locked. */
  retryAfterMs(key: string, now = Date.now()): number {
    const lockedUntil = this.entries.get(key)?.lockedUntil ?? 0;
    return Math.max(0, lockedUntil - now);
  }

  recordFailure(key: string, now = Date.now()): void {
    const { maxFailures, windowMs, lockoutMs } = this.options;
    this.prune(now);
    let entry = this.entries.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { failures: 0, windowStart: now, lockedUntil: 0 };
      this.entries.set(key, entry);
    }
    entry.failures += 1;
    if (entry.failures >= maxFailures) {
      entry.lockedUntil = now + lockoutMs;
      entry.failures = 0;
      entry.windowStart = now;
    }
  }

  /** Clears the count after a correct passcode. */
  recordSuccess(key: string): void {
    this.entries.delete(key);
  }

  /** Drops expired entries so a spray of addresses cannot grow the map forever. */
  private prune(now: number): void {
    const { windowMs } = this.options;
    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil <= now && now - entry.windowStart >= windowMs) {
        this.entries.delete(key);
      }
    }
  }
}
