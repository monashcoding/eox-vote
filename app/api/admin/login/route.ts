import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminToken,
  getAdminPasscode,
  setAdminCookie,
  verifyPasscode,
} from "@/lib/auth/admin";
import { LoginLimiter } from "@/lib/auth/login-limiter";
import { errorResponse, handleRoute, HttpError } from "@/lib/http";

const loginSchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
});

const WINDOW_MS = 60_000;
const LOCKOUT_MS = 60_000;
const perClient = new LoginLimiter({ maxFailures: 10, windowMs: WINDOW_MS, lockoutMs: LOCKOUT_MS });
// Shared by every client, so guessing from many addresses is capped too.
const everyone = new LoginLimiter({ maxFailures: 50, windowMs: WINDOW_MS, lockoutMs: LOCKOUT_MS });
const EVERYONE_KEY = "*";

/**
 * The address that reached us. Next fills `x-forwarded-for` from the socket
 * when it is absent, and a reverse proxy appends the real client last, so the
 * last entry is the one a client cannot choose.
 */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",").at(-1)?.trim() || "unknown";
}

export const POST = handleRoute(async (request: Request) => {
  const client = clientKey(request);
  const retryAfterMs = Math.max(
    perClient.retryAfterMs(client),
    everyone.retryAfterMs(EVERYONE_KEY)
  );
  if (retryAfterMs > 0) {
    const response = errorResponse(
      429,
      "Too many wrong passcodes. Wait a minute and try again."
    );
    response.headers.set("retry-after", String(Math.ceil(retryAfterMs / 1000)));
    return response;
  }
  // Count the attempt now, before any await, so a parallel burst cannot all
  // pass the check above; a correct passcode clears it again below.
  perClient.recordFailure(client);
  everyone.recordFailure(EVERYONE_KEY);

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
  perClient.recordSuccess(client);
  everyone.recordSuccess(EVERYONE_KEY);
  const { token, maxAgeSeconds } = createAdminToken(actualPasscode);
  await setAdminCookie(token, maxAgeSeconds);

  return NextResponse.json({ success: true });
});
