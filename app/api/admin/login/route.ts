import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminToken,
  getAdminPasscode,
  setAdminCookie,
  verifyPasscode,
} from "@/lib/auth/admin";
import { handleRoute, HttpError } from "@/lib/http";

const loginSchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
});

export const POST = handleRoute(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const { passcode } = loginSchema.parse(body);

  const actualPasscode = await getAdminPasscode();

  const isMatch = await verifyPasscode(passcode, actualPasscode);
  if (!isMatch) {
    // Spec: "wrong passcode -> wait ~500 ms then 401"
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 500);
    await promise;
    throw new HttpError(401, "Invalid passcode");
  }
  const { token, maxAgeSeconds } = createAdminToken(actualPasscode);
  await setAdminCookie(token, maxAgeSeconds);

  return NextResponse.json({ success: true });
});
