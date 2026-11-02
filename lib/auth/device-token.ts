import crypto from "node:crypto";

/**
 * Device tokens are `<random>.<hmac>`: the server signs the random part with
 * `DEVICE_SECRET`, so a client cannot make up its own device identity.
 */

export function readDeviceSecret(): string {
  const secret = process.env.DEVICE_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "DEVICE_SECRET is not set. Add a long random value to .env (openssl rand -base64 32)."
    );
  }
  return secret;
}

function sign(id: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(id).digest("base64url");
}

export function issueDeviceToken(secret: string): string {
  const id = crypto.randomBytes(32).toString("base64url");
  return `${id}.${sign(id, secret)}`;
}

export function isValidDeviceToken(
  token: string | undefined,
  secret: string
): token is string {
  if (!token) return false;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return false;
  const actual = Buffer.from(token.slice(dotIdx + 1));
  const expected = Buffer.from(sign(token.slice(0, dotIdx), secret));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** What the database stores: sha256 hex of the whole token. */
export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
