import { NextResponse } from "next/server";
import type { VotesDto } from "@/lib/api-types";
import { getDeviceTokenHash } from "@/lib/auth/device";
import { handleRoute } from "@/lib/http";
import { requireNomineeId } from "@/lib/nominees";
import { castVote, removeVote } from "@/lib/votes";

interface RouteContext {
  params: Promise<{ nomineeId: string }>;
}

function votesResponse(votes: string[]): NextResponse {
  const body: VotesDto = { votes };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export const PUT = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    const nomineeId = requireNomineeId((await params).nomineeId);
    const deviceHash = await getDeviceTokenHash();
    return votesResponse(await castVote(nomineeId, deviceHash));
  }
);

export const DELETE = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    const nomineeId = requireNomineeId((await params).nomineeId);
    const deviceHash = await getDeviceTokenHash();
    return votesResponse(await removeVote(nomineeId, deviceHash));
  }
);
