import { NextResponse } from "next/server";
import type { SponsorsDto } from "@/lib/api-types";
import { requireAdmin } from "@/lib/auth/admin";
import { handleRoute } from "@/lib/http";
import { createSponsor, listSponsors } from "@/lib/sponsors";

export const GET = handleRoute(async () => {
  await requireAdmin();
  const body: SponsorsDto = { sponsors: await listSponsors() };
  return NextResponse.json(body);
});

/** Multipart `name`, `shortName?`, `logo` -> 201 SponsorDto. */
export const POST = handleRoute(async (request: Request) => {
  await requireAdmin();
  const sponsor = await createSponsor(request);
  return NextResponse.json(sponsor, { status: 201 });
});
