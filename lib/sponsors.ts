import { eq, sql } from "drizzle-orm";
import type { SponsorDto } from "./api-types";
import { readBodyWithLimit } from "./body-limit";
import { db, type DbReader, type DbTransaction } from "./db";
import { sponsorLogos, sponsors } from "./db/schema";
import { HttpError, requireUuid } from "./http";
import { detectImageType } from "./photos";
import { invalidatePublicState } from "./session/public-state";
import {
  normaliseSponsorName,
  normaliseSponsorShortName,
  SPONSOR_NAME_ERROR,
  SPONSOR_SHORT_NAME_ERROR,
} from "./sponsor-fields";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
/** Whole multipart body: the logo plus room for the names and part headers. */
const MAX_SPONSOR_FORM_BYTES = MAX_LOGO_BYTES + 64 * 1024;
const LOGO_TOO_BIG = "Logo must be 2 MB or smaller";
const SPONSOR_NOT_FOUND = "Sponsor not found";

type SponsorRow = typeof sponsors.$inferSelect;

export function toSponsorDto(row: SponsorRow): SponsorDto {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    logoUrl: `/api/sponsor-logos/${row.id}?v=${row.logoVersion}`,
  };
}

export async function listSponsors(): Promise<SponsorDto[]> {
  const rows = await db
    .select()
    .from(sponsors)
    .orderBy(sql`lower(${sponsors.name})`, sponsors.name);
  return rows.map(toSponsorDto);
}

export async function getSponsorDto(
  sponsorId: string | null,
  executor: DbReader = db
): Promise<SponsorDto | null> {
  if (sponsorId === null) return null;
  const [row] = await executor
    .select()
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);
  return row ? toSponsorDto(row) : null;
}

/**
 * 404 unless the sponsor exists. The share lock makes a concurrent delete
 * wait, so a session pointing at it cannot hit a missing foreign key.
 */
export async function lockSponsorInTx(
  tx: DbTransaction,
  sponsorId: string
): Promise<void> {
  requireUuid(sponsorId, SPONSOR_NOT_FOUND);
  const [row] = await tx
    .select({ id: sponsors.id })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .for("share");
  if (!row) {
    throw new HttpError(404, SPONSOR_NOT_FOUND);
  }
}

interface SponsorForm {
  name: string;
  shortName: string | null;
  logo: { contentType: string; data: Buffer };
}

/**
 * Reads a multipart sponsor body (`name`, `shortName?`, `logo`). Bodies
 * without a `content-length` or above the cap are rejected with 413 before
 * they are buffered. The logo must be PNG, JPEG or WebP by magic bytes: an
 * SVG served from this origin could run script, so it is refused (415).
 */
async function parseSponsorForm(request: Request): Promise<SponsorForm> {
  const body = await readBodyWithLimit(request, MAX_SPONSOR_FORM_BYTES);
  if (!body) {
    throw new HttpError(413, LOGO_TOO_BIG);
  }

  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new HttpError(400, "Expected a multipart form body");
  }

  const rawName = form.get("name");
  const name = typeof rawName === "string" ? normaliseSponsorName(rawName) : null;
  if (name === null) {
    throw new HttpError(400, SPONSOR_NAME_ERROR);
  }

  const rawShortName = form.get("shortName");
  const shortName =
    typeof rawShortName === "string" ? normaliseSponsorShortName(rawShortName) : null;
  if (shortName === undefined) {
    throw new HttpError(400, SPONSOR_SHORT_NAME_ERROR);
  }

  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(400, "Choose a logo image");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new HttpError(413, LOGO_TOO_BIG);
  }
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = detectImageType(data);
  if (!contentType) {
    throw new HttpError(415, "Logo must be a PNG, JPEG or WebP image");
  }

  return { name, shortName, logo: { contentType, data } };
}

/** Postgres unique violation, possibly wrapped by Drizzle's query error. */
function isUniqueViolation(err: unknown): boolean {
  for (let current = err; current instanceof Error; current = current.cause) {
    if ("code" in current && current.code === "23505") return true;
  }
  return false;
}

export async function createSponsor(request: Request): Promise<SponsorDto> {
  const form = await parseSponsorForm(request);
  let row: SponsorRow;
  try {
    row = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(sponsors)
        .values({ name: form.name, shortName: form.shortName })
        .returning();
      await tx.insert(sponsorLogos).values({
        sponsorId: inserted.id,
        contentType: form.logo.contentType,
        data: form.logo.data,
      });
      return inserted;
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, `A sponsor called ${form.name} already exists`);
    }
    throw err;
  }

  invalidatePublicState();
  return toSponsorDto(row);
}
