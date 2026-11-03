const MAX_SLUG_LENGTH = 60;
const FALLBACK_SLUG = "session";

/** Lowercase ASCII slug: accents folded, runs of other characters become "-". */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || FALLBACK_SLUG;
}

/** Download name for a session's QR image, e.g. `best-dressed-2026-qr.png`. */
export function qrFilename(sessionName: string): string {
  return `${slugify(sessionName)}-qr.png`;
}

/** Download name for the code alone, e.g. `best-dressed-2026-qr-square.png`. */
export function qrSquareFilename(sessionName: string): string {
  return `${slugify(sessionName)}-qr-square.png`;
}
