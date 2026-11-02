import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashDeviceToken,
  isValidDeviceToken,
  issueDeviceToken,
  readDeviceSecret,
} from "./device-token.ts";

const SECRET = "test-secret";

describe("device tokens", () => {
  it("accepts a token it issued", () => {
    assert.equal(isValidDeviceToken(issueDeviceToken(SECRET), SECRET), true);
  });

  it("issues a different token each time", () => {
    assert.notEqual(issueDeviceToken(SECRET), issueDeviceToken(SECRET));
  });

  it("rejects missing, unsigned and made-up tokens", () => {
    assert.equal(isValidDeviceToken(undefined, SECRET), false);
    assert.equal(isValidDeviceToken("", SECRET), false);
    assert.equal(isValidDeviceToken("abcdef", SECRET), false);
    assert.equal(isValidDeviceToken(".sig", SECRET), false);
    assert.equal(isValidDeviceToken("abc.def", SECRET), false);
  });

  it("rejects a tampered id or a token signed with another secret", () => {
    const token = issueDeviceToken(SECRET);
    const [id, sig] = token.split(".");
    assert.equal(isValidDeviceToken(`${id}x.${sig}`, SECRET), false);
    assert.equal(isValidDeviceToken(token, "other-secret"), false);
  });

  it("hashes to 64 hex characters", () => {
    assert.match(hashDeviceToken(issueDeviceToken(SECRET)), /^[0-9a-f]{64}$/);
  });
});

describe("readDeviceSecret", () => {
  const original = process.env.DEVICE_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.DEVICE_SECRET;
    else process.env.DEVICE_SECRET = original;
  });

  it("throws a clear error when unset or blank", () => {
    delete process.env.DEVICE_SECRET;
    assert.throws(readDeviceSecret, /DEVICE_SECRET is not set/);
    process.env.DEVICE_SECRET = "   ";
    assert.throws(readDeviceSecret, /DEVICE_SECRET is not set/);
  });

  it("returns the configured secret", () => {
    process.env.DEVICE_SECRET = "abc";
    assert.equal(readDeviceSecret(), "abc");
  });
});
