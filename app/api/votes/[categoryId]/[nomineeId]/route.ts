import { NextResponse } from "next/server";
import type { VoteDto, VotesDto } from "@/lib/api-types";
import { requireDeviceTokenHash } from "@/lib/auth/device";
import { requireCategoryId } from "@/lib/categories";
import { handleRoute } from "@/lib/http";
import { requireNomineeId } from "@/lib/nominees";
import { castVote, removeVote } from "@/lib/votes";

interface RouteContext {
  params: Promise<{ categoryId: string; nomineeId: string }>;
}

function votesResponse(votes: VoteDto[]): NextResponse {
  const body: VotesDto = { votes };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export const PUT = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    const { categoryId, nomineeId } = await params;
    const category = requireCategoryId(categoryId);
    const nominee = requireNomineeId(nomineeId);
    const deviceHash = await requireDeviceTokenHash();
    return votesResponse(await castVote(category, nominee, deviceHash));
  }
);

export const DELETE = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    const { categoryId, nomineeId } = await params;
    const category = requireCategoryId(categoryId);
    const nominee = requireNomineeId(nomineeId);
    const deviceHash = await requireDeviceTokenHash();
    return votesResponse(await removeVote(category, nominee, deviceHash));
  }
);
