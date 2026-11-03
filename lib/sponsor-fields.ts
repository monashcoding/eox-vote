export const SPONSOR_NAME_MAX = 80;
export const SPONSOR_SHORT_NAME_MAX = 20;

export const SPONSOR_NAME_ERROR = `Sponsor name must be between 1 and ${SPONSOR_NAME_MAX} characters`;
export const SPONSOR_SHORT_NAME_ERROR = `Short name must be ${SPONSOR_SHORT_NAME_MAX} characters or fewer`;

/** Trims and collapses whitespace; null when the name is empty or too long. */
export function normaliseSponsorName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= SPONSOR_NAME_MAX ? name : null;
}

/**
 * The short name is optional: blank means none (`null`). Returns `undefined`
 * when it is too long.
 */
export function normaliseSponsorShortName(value: string): string | null | undefined {
  const shortName = value.trim().replace(/\s+/g, " ");
  if (shortName.length === 0) return null;
  return shortName.length <= SPONSOR_SHORT_NAME_MAX ? shortName : undefined;
}
