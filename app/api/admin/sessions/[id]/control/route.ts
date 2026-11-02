import { NextResponse } from "next/server";
import { z } from "zod";
import { ControlAction, type ControlRequest } from "@/lib/api-types";
import { requireAdmin } from "@/lib/auth/admin";
import { handleRoute, HttpError } from "@/lib/http";
import { applyAdminSessionControl } from "@/lib/session";
import { EngineError, MAX_TIMER_MS } from "@/lib/session/engine";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const controlSchema = z.union([
  z.object({
    action: z.enum([
      ControlAction.Next,
      ControlAction.Previous,
      ControlAction.Pause,
      ControlAction.Resume,
      ControlAction.ClearTimer,
      ControlAction.RevealNext,
      ControlAction.HideLast,
    ]),
  }),
  z.object({
    action: z.literal(ControlAction.AdjustTimer),
    deltaMs: z.number().int().min(-MAX_TIMER_MS).max(MAX_TIMER_MS),
  }),
  z.object({
    action: z.literal(ControlAction.SetTimer),
    durationMs: z.number().int().min(1).max(MAX_TIMER_MS),
  }),
  z.object({
    action: z.literal(ControlAction.SetTimer),
    endsAt: z.number().int().positive(),
  }),
]);

export const POST = handleRoute<RouteContext>(
  async (request: Request, { params }) => {
    await requireAdmin();
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    const parsed = controlSchema.parse(body) as ControlRequest;
    try {
      const detail = await applyAdminSessionControl(id, parsed);
      return NextResponse.json(detail);
    } catch (err: unknown) {
      if (err instanceof EngineError) {
        throw new HttpError(409, err.message);
      }
      throw err;
    }
  }
);
