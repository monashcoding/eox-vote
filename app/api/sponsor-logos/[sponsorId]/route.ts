import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sponsorLogos } from "@/lib/db/schema";
import { handleRoute, HttpError, requireUuid } from "@/lib/http";

interface RouteContext {
  params: Promise<{ sponsorId: string }>;
}

/** The URL carries `?v=<logo_version>`, so the bytes behind it never change. */
export const GET = handleRoute<RouteContext>(
  async (_request: Request, { params }) => {
    const sponsorId = requireUuid((await params).sponsorId, "Logo not found");
    const [logo] = await db
      .select({
        contentType: sponsorLogos.contentType,
        data: sponsorLogos.data,
      })
      .from(sponsorLogos)
      .where(eq(sponsorLogos.sponsorId, sponsorId))
      .limit(1);
    if (!logo) {
      throw new HttpError(404, "Logo not found");
    }
    return new Response(new Uint8Array(logo.data), {
      headers: {
        "content-type": logo.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }
);
