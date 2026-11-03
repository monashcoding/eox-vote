import { z } from "zod";
import { readBodyWithLimit } from "./body-limit";
import { HttpError } from "./http";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Whole multipart body: the photo plus room for the names and part headers. */
export const MAX_NOMINEE_FORM_BYTES = MAX_PHOTO_BYTES + 512 * 1024;

export interface ParsedPhoto {
  contentType: string;
  data: Buffer;
}

const NAME_ERROR = "Names must be between 1 and 50 characters";

export const nameSchema = z
  .string(NAME_ERROR)
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, NAME_ERROR).max(50, NAME_ERROR));

/** JPEG, PNG or WebP by magic bytes; null for anything else (SVG included). */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

/** Validates an uploaded file: at most 5 MB (413), jpeg/png/webp by magic bytes (415). */
export async function parsePhoto(file: File): Promise<ParsedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new HttpError(413, "Photo must be 5 MB or smaller");
  }
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = detectImageType(data);
  if (!contentType) {
    throw new HttpError(415, "Photo must be a JPEG, PNG or WebP image");
  }
  return { contentType, data };
}

export interface NomineeForm {
  firstName: string | undefined;
  lastName: string | undefined;
  photo: ParsedPhoto | undefined;
}

/**
 * Reads a multipart nominee body. Every field is optional here; callers decide
 * which are required. Present names are validated, a present photo is parsed.
 * Bodies without a `content-length` or above `MAX_NOMINEE_FORM_BYTES` are
 * rejected with 413 before they are buffered.
 */
export async function parseNomineeForm(request: Request): Promise<NomineeForm> {
  const body = await readBodyWithLimit(request, MAX_NOMINEE_FORM_BYTES);
  if (!body) {
    throw new HttpError(413, "Photo must be 5 MB or smaller");
  }

  let form: FormData;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    form = await new Response(body, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new HttpError(400, "Expected a multipart form body");
  }

  const rawFirst = form.get("firstName");
  const rawLast = form.get("lastName");
  const file = form.get("photo");

  return {
    firstName: rawFirst === null ? undefined : nameSchema.parse(rawFirst),
    lastName: rawLast === null ? undefined : nameSchema.parse(rawLast),
    photo: file instanceof File && file.size > 0 ? await parsePhoto(file) : undefined,
  };
}
