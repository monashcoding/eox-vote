import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { handleRoute, HttpError } from "@/lib/http";
import { createAdminSession, listAdminSessions } from "@/lib/session";

const createSessionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name must be between 1 and 80 characters")
    .max(80, "Name must be between 1 and 80 characters"),
  nominatingMinutes: z.number().int().min(0).max(600).optional(),
  votingMinutes: z.number().int().min(0).max(600).optional(),
  autoAdvance: z.boolean().optional(),
  sponsorId: z.string().nullable().optional(),
});

export const GET = handleRoute(async () => {
  await requireAdmin();
  const data = await listAdminSessions();
  return NextResponse.json(data);
});

export const POST = handleRoute(async (request: Request) => {
  await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const parsed = createSessionSchema.parse(body);
  const detail = await createAdminSession(parsed);
  return NextResponse.json(detail, { status: 201 });
});
