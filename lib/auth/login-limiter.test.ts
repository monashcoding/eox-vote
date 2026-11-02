import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LoginLimiter } from "./login-limiter.ts";

const options = { maxFailures: 3, windowMs: 1000, lockoutMs: 5000 };

describe("LoginLimiter", () => {
  it("locks a key after the maximum failures and unlocks after the lockout", () => {
    const limiter = new LoginLimiter(options);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 10);
    assert.equal(limiter.retryAfterMs("a", 20), 0);
    limiter.recordFailure("a", 20);
    assert.equal(limiter.retryAfterMs("a", 20), 5000);
    assert.equal(limiter.retryAfterMs("a", 4020), 1000);
    assert.equal(limiter.retryAfterMs("a", 5020), 0);
  });

  it("keeps keys separate", () => {
    const limiter = new LoginLimiter(options);
    for (let i = 0; i < 3; i++) limiter.recordFailure("a", 0);
    assert.ok(limiter.retryAfterMs("a", 0) > 0);
    assert.equal(limiter.retryAfterMs("b", 0), 0);
  });

  it("forgets failures older than the window", () => {
    const limiter = new LoginLimiter(options);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 10);
    limiter.recordFailure("a", 1500);
    assert.equal(limiter.retryAfterMs("a", 1500), 0);
  });

  it("clears a key on success", () => {
    const limiter = new LoginLimiter(options);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 0);
    limiter.recordSuccess("a");
    limiter.recordFailure("a", 0);
    assert.equal(limiter.retryAfterMs("a", 0), 0);
  });
});
