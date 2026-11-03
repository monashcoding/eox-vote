import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { handleRoute, HttpError } from "@/lib/http";
import {
  deleteAdminSession,
  getAdminSessionDetail,
  requireSessionId,
  updateAdminSession,
} from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateSessionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name must be between 1 and 80 characters")
    .max(80, "Name must be between 1 and 80 characters")
    .optional(),
  nominatingMinutes: z.number().int().min(0).max(600).optional(),
  votingMinutes: z.number().int().min(0).max(600).optional(),
  autoAdvance: z.boolean().optional(),
  sponsorId: z.string().nullable().optional(),
});

export const GET = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    await requireAdmin();
    const id = requireSessionId((await params).id);
    const detail = await getAdminSessionDetail(id);
    return NextResponse.json(detail);
  }
);

export const PATCH = handleRoute<RouteContext>(
  async (request: Request, { params }) => {
    await requireAdmin();
    const id = requireSessionId((await params).id);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    const parsed = updateSessionSchema.parse(body);
    const detail = await updateAdminSession(id, parsed);
    return NextResponse.json(detail);
  }
);

export const DELETE = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    await requireAdmin();
    const id = requireSessionId((await params).id);
    await deleteAdminSession(id);
    return new NextResponse(null, { status: 204 });
  }
);
