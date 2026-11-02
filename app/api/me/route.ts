import { NextResponse } from "next/server";
import type { MeDto } from "@/lib/api-types";
import { getDeviceTokenHash } from "@/lib/auth/device";
import { handleRoute } from "@/lib/http";
import { listOwnedNominees } from "@/lib/nominees";
import { getCurrentSessionId } from "@/lib/session";

export const GET = handleRoute(async () => {
  const deviceHash = await getDeviceTokenHash();
  const sessionId = await getCurrentSessionId();
  const me: MeDto = {
    sessionId,
    nominations: sessionId ? await listOwnedNominees(sessionId, deviceHash) : [],
  };
  return NextResponse.json(me, { headers: { "cache-control": "no-store" } });
});
