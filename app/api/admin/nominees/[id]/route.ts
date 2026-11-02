import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { handleRoute } from "@/lib/http";
import { deleteNomineeAsAdmin, updateNomineeAsAdmin } from "@/lib/nominations";
import { requireNomineeId } from "@/lib/nominees";
import { parseNomineeForm } from "@/lib/photos";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = handleRoute<RouteContext>(
  async (request: Request, { params }) => {
    await requireAdmin();
    const id = requireNomineeId((await params).id);
    const form = await parseNomineeForm(request);
    const nominee = await updateNomineeAsAdmin(id, form);
    return NextResponse.json(nominee);
  }
);

export const DELETE = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    await requireAdmin();
    const id = requireNomineeId((await params).id);
    await deleteNomineeAsAdmin(id);
    return new NextResponse(null, { status: 204 });
  }
);
