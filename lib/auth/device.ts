import { cookies } from "next/headers";
import { HttpError } from "../http";
import {
  hashDeviceToken,
  isValidDeviceToken,
  issueDeviceToken,
  readDeviceSecret,
} from "./device-token";

export const DEVICE_COOKIE_NAME = "eox_device";
const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

/**
 * Returns sha256 hex of this browser's device token, issuing a new signed
 * httpOnly cookie when the browser has none or an invalid one. Only `/api/me`
 * may call this; every other attendee route uses `requireDeviceTokenHash`.
 */
export async function getOrIssueDeviceTokenHash(): Promise<string> {
  const secret = readDeviceSecret();
  const cookieStore = await cookies();
  let token = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  if (!isValidDeviceToken(token, secret)) {
    token = issueDeviceToken(secret);
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
  return hashDeviceToken(token);
}

/**
 * Returns sha256 hex of the device token this server issued earlier. Requests
 * without a valid signed cookie get 401, so a script cannot vote or nominate
 * as a brand-new device on every request.
 */
export async function requireDeviceTokenHash(): Promise<string> {
  const secret = readDeviceSecret();
  const token = (await cookies()).get(DEVICE_COOKIE_NAME)?.value;
  if (!isValidDeviceToken(token, secret)) {
    throw new HttpError(401, "We could not recognise this device. Reload the page and try again.");
  }
  return hashDeviceToken(token);
}
