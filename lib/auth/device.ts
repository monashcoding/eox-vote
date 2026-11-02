import { cookies } from "next/headers";
import crypto from "node:crypto";

export const DEVICE_COOKIE_NAME = "eox_device";
const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

/**
 * Returns sha256 hex of this browser's device token, creating the httpOnly
 * cookie first when the browser does not have one yet.
 */
export async function getDeviceTokenHash(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  if (!token) {
    token = crypto.randomBytes(32).toString("base64url");
    cookieStore.set({
      name: DEVICE_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    });
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}
