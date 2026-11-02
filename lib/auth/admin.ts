import { cookies } from "next/headers";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { appSettings } from "../db/schema";
import { HttpError } from "../http";

export const ADMIN_COOKIE_NAME = "eox_admin";
const ADMIN_TOKEN_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const ADMIN_TOKEN_PREFIX = "eox-admin:";

export async function getAdminPasscode(): Promise<string> {
  const [settings] = await db
    .select({ passcode: appSettings.adminPasscode })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  const passcode = settings?.passcode?.trim();
  if (!passcode) {
    throw new HttpError(
      503,
      "Admin passcode is not set. Ask the database administrator to set app_settings.admin_passcode."
    );
  }
  return passcode;
}

export function createAdminToken(passcode: string): {
  token: string;
  expiresAt: number;
  maxAgeSeconds: number;
} {
  const expiresAt = Date.now() + ADMIN_TOKEN_DURATION_MS;
  const signature = crypto
    .createHmac("sha256", passcode)
    .update(`${ADMIN_TOKEN_PREFIX}${expiresAt}`)
    .digest("base64url");

  return {
    token: `${expiresAt}.${signature}`,
    expiresAt,
    maxAgeSeconds: Math.floor(ADMIN_TOKEN_DURATION_MS / 1000),
  };
}

export function verifyAdminToken(
  token: string | undefined | null,
  passcode: string
): boolean {
  if (!token) return false;

  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return false;

  const expiresAtStr = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);
  const expiresAt = Number(expiresAtStr);

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", passcode)
    .update(`${ADMIN_TOKEN_PREFIX}${expiresAtStr}`)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function verifyPasscode(
  candidate: string,
  actual: string
): Promise<boolean> {
  const candDigest = crypto.createHash("sha256").update(candidate).digest();
  const actualDigest = crypto.createHash("sha256").update(actual).digest();
  return crypto.timingSafeEqual(candDigest, actualDigest);
}

export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    throw new HttpError(401, "Not signed in");
  }

  let passcode: string;
  try {
    passcode = await getAdminPasscode();
  } catch {
    throw new HttpError(401, "Not signed in");
  }

  if (!verifyAdminToken(token, passcode)) {
    throw new HttpError(401, "Not signed in");
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function setAdminCookie(token: string, maxAge: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
