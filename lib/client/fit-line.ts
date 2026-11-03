/** How to show a line of text inside a width it may not fit. */
export interface LineFit {
  /** Font size as a fraction of full size. */
  scale: number;
  /** True when even `minScale` is too wide, so the line wraps at `minScale`. */
  wrap: boolean;
}

/**
 * Fits a line that is `natural` px wide at full size into `target` px: full
 * size when it fits, shrunk to fit when it does not, and past `minScale`
 * (too small to read) wrapped at `minScale` instead.
 */
export function fitLine(
  natural: number,
  target: number,
  minScale: number
): LineFit {
  if (natural <= 0 || target <= 0 || natural <= target) {
    return { scale: 1, wrap: false };
  }
  const scale = target / natural;
  return scale >= minScale
    ? { scale, wrap: false }
    : { scale: minScale, wrap: true };
}
