import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/auth/admin";
import { handleRoute } from "@/lib/http";

export const POST = handleRoute(async () => {
  await clearAdminCookie();
  return NextResponse.json({ success: true });
});
