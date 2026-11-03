import { connection, NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { getPublicState } from "@/lib/session/public-state";

export const GET = handleRoute(async () => {
  // Prerendering stops here, so `next build` never opens a database connection.
  await connection();
  const state = await getPublicState();
  return NextResponse.json(state, {
    headers: {
      "cache-control": "no-store",
    },
  });
});
