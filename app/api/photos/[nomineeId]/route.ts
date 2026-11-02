import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { nomineePhotos } from "@/lib/db/schema";
import { handleRoute, HttpError } from "@/lib/http";
import { requireNomineeId } from "@/lib/nominees";

interface RouteContext {
  params: Promise<{ nomineeId: string }>;
}

export const GET = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    const nomineeId = requireNomineeId((await params).nomineeId);
    const [photo] = await db
      .select({
        contentType: nomineePhotos.contentType,
        data: nomineePhotos.data,
      })
      .from(nomineePhotos)
      .where(eq(nomineePhotos.nomineeId, nomineeId))
      .limit(1);
    if (!photo) {
      throw new HttpError(404, "Photo not found");
    }
    return new Response(new Uint8Array(photo.data), {
      headers: {
        "content-type": photo.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }
);
