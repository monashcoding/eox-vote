import { NextResponse } from "next/server";
import { getDeviceTokenHash } from "@/lib/auth/device";
import { handleRoute } from "@/lib/http";
import { createNomination } from "@/lib/nominations";
import { parseNomineeForm } from "@/lib/photos";

export const POST = handleRoute(async (request: Request) => {
  const deviceHash = await getDeviceTokenHash();
  const form = await parseNomineeForm(request);
  const nominee = await createNomination(deviceHash, form);
  return NextResponse.json(nominee, { status: 201 });
});
