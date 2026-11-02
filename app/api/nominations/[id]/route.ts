import { NextResponse } from "next/server";
import { requireDeviceTokenHash } from "@/lib/auth/device";
import { handleRoute } from "@/lib/http";
import {
  assertCanNominate,
  deleteOwnNomination,
  updateOwnNomination,
} from "@/lib/nominations";
import { requireNomineeId } from "@/lib/nominees";
import { parseNomineeForm } from "@/lib/photos";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = handleRoute<RouteContext>(
  async (request: Request, { params }) => {
    const id = requireNomineeId((await params).id);
    const deviceHash = await requireDeviceTokenHash();
    await assertCanNominate(deviceHash, id);
    const form = await parseNomineeForm(request);
    const nominee = await updateOwnNomination(id, deviceHash, form);
    return NextResponse.json(nominee);
  }
);

export const DELETE = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    const id = requireNomineeId((await params).id);
    const deviceHash = await requireDeviceTokenHash();
    await deleteOwnNomination(id, deviceHash);
    return new NextResponse(null, { status: 204 });
  }
);
