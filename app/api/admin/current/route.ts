import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { handleRoute, HttpError } from "@/lib/http";
import { setCurrentSession } from "@/lib/session";

const currentSessionSchema = z.object({
  sessionId: z.string().uuid().nullable(),
});

export const PUT = handleRoute(async (request: Request) => {
  await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const { sessionId } = currentSessionSchema.parse(body);
  const result = await setCurrentSession(sessionId);
  return NextResponse.json(result);
});
