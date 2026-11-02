import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { handleRoute } from "@/lib/http";

export const GET = handleRoute(async () => {
  await requireAdmin();
  return NextResponse.json({ authenticated: true });
});
