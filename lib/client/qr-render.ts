import QRCode from "qrcode";

// The image is a printed artefact on white paper, so these are literal colours
// rather than theme tokens (the dark UI theme must not leak into the PNG).
const PAPER_COLOUR = "#ffffff";
const MODULE_COLOUR = "#000000";
const TEXT_COLOUR = "#252525";

const IMAGE_WIDTH_PX = 1280;
const MARGIN_PX = 80;
/** Quiet zone required by the QR spec, in modules. */
const QUIET_ZONE_MODULES = 4;
const CAPTION_FONT_PX = 64;
const CAPTION_LINE_PX = 78;
const URL_FONT_PX = 40;
const URL_LINE_PX = 52;
const GAP_PX = 56;
const LOGO_PX = 176;
const MAX_CAPTION_LINES = 3;
const MAX_URL_LINES = 4;

export interface QrImageContent {
  caption: string;
  url: string;
  /** MAC logo drawn above the caption, already loaded. */
  logo?: CanvasImageSource;
}

function wrapWords(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    // A single word wider than the line is broken by character below.
    while (context.measureText(current).width > maxWidth) {
      const cut = fitPrefix(context, current, maxWidth);
      lines.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  if (current) lines.push(current);
  return truncate(context, lines, maxWidth, maxLines);
}

/** Wraps text with no spaces (URLs) by character. */
function wrapChars(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines: string[] = [];
  let rest = text;
  while (rest) {
    const cut = fitPrefix(context, rest, maxWidth);
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return truncate(context, lines, maxWidth, maxLines);
}

/** Largest prefix length (at least 1) that fits in maxWidth. */
function fitPrefix(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): number {
  let low = 1;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (context.measureText(text.slice(0, mid)).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low;
}

function truncate(
  context: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
  maxLines: number
): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]}...`;
  while (last.length > 4 && context.measureText(last).width > maxWidth) {
    last = `${last.slice(0, -4)}...`;
  }
  kept[maxLines - 1] = last;
  return kept;
}

/**
 * Draws a printable QR poster onto `canvas`: white paper, the MAC logo, the
 * caption above the code, black modules with a quiet zone, and the encoded URL
 * below it. The canvas is 1280 px wide; its height follows the text. Throws if
 * the text does not fit in a QR code.
 */
export function renderQrImage(
  canvas: HTMLCanvasElement,
  { caption, url, logo }: QrImageContent,
  fontFamily: string
): void {
  // Error correction Q (25 percent) survives scuffs and projector glare.
  const qr = QRCode.create(url, { errorCorrectionLevel: "Q" });
  const moduleCount = qr.modules.size;
  const bits = qr.modules.data;

  const contentWidth = IMAGE_WIDTH_PX - MARGIN_PX * 2;
  const modulePx = Math.max(
    1,
    Math.floor(contentWidth / (moduleCount + QUIET_ZONE_MODULES * 2))
  );
  const codePx = modulePx * moduleCount;
  const quietPx = modulePx * QUIET_ZONE_MODULES;
  const boxPx = codePx + quietPx * 2;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the QR code.");

  const captionFont = `600 ${CAPTION_FONT_PX}px ${fontFamily}`;
  const urlFont = `500 ${URL_FONT_PX}px ${fontFamily}`;

  // Measure first: canvas height depends on how the text wraps.
  context.font = captionFont;
  const captionLines = wrapWords(
    context,
    caption,
    contentWidth,
    MAX_CAPTION_LINES
  );
  context.font = urlFont;
  const urlLines = wrapChars(context, url, contentWidth, MAX_URL_LINES);

  const logoBlockPx = logo ? LOGO_PX + GAP_PX : 0;
  const height =
    MARGIN_PX +
    logoBlockPx +
    captionLines.length * CAPTION_LINE_PX +
    GAP_PX +
    boxPx +
    GAP_PX +
    urlLines.length * URL_LINE_PX +
    MARGIN_PX;

  canvas.width = IMAGE_WIDTH_PX;
  canvas.height = height;

  context.fillStyle = PAPER_COLOUR;
  context.fillRect(0, 0, IMAGE_WIDTH_PX, height);

  context.fillStyle = TEXT_COLOUR;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const centreX = IMAGE_WIDTH_PX / 2;

  let y = MARGIN_PX;
  if (logo) {
    // Above the caption, well clear of the modules and their quiet zone.
    context.drawImage(logo, centreX - LOGO_PX / 2, y, LOGO_PX, LOGO_PX);
    y += LOGO_PX + GAP_PX;
  }
  context.font = captionFont;
  for (const line of captionLines) {
    context.fillText(line, centreX, y + CAPTION_LINE_PX / 2);
    y += CAPTION_LINE_PX;
  }
  y += GAP_PX;

  // Integer module size keeps edges crisp; the quiet zone is already paper.
  const codeLeft = Math.round((IMAGE_WIDTH_PX - codePx) / 2);
  const codeTop = y + quietPx;
  context.fillStyle = MODULE_COLOUR;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (bits[row * moduleCount + col]) {
        context.fillRect(
          codeLeft + col * modulePx,
          codeTop + row * modulePx,
          modulePx,
          modulePx
        );
      }
    }
  }
  y += boxPx + GAP_PX;

  context.fillStyle = TEXT_COLOUR;
  context.font = urlFont;
  for (const line of urlLines) {
    context.fillText(line, centreX, y + URL_LINE_PX / 2);
    y += URL_LINE_PX;
  }
}
