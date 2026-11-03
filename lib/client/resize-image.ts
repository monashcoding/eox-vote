const PHOTO_MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;
const LOGO_MAX_EDGE_PX = 512;
const WEBP_QUALITY = 0.92;

/**
 * Decodes `file` (applying EXIF orientation) and draws it onto a canvas no
 * larger than `maxEdge` on the long edge. Never upscales.
 */
async function drawScaled(
  file: File,
  maxEdge: number,
  unreadableMessage: string
): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(unreadableMessage);
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser cannot process images.");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  // Executor form on purpose: Promise.withResolvers is missing on iOS < 17.4,
  // and this runs on attendees' phones.
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function baseName(file: File, fallback: string): string {
  return file.name.replace(/\.[^.]*$/, "") || fallback;
}

/**
 * Downscales a photo to at most 1600 px on the long edge and re-encodes it as
 * JPEG (quality 0.85). EXIF orientation is applied to the pixels and the
 * metadata is dropped. Throws an Error with a user-facing message when the
 * browser cannot decode the file (for example HEIC on most desktop browsers).
 */
export async function resizeImage(file: File): Promise<File> {
  const canvas = await drawScaled(
    file,
    PHOTO_MAX_EDGE_PX,
    "This browser cannot read that photo. Try a JPEG or PNG image instead."
  );
  const blob = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (!blob) {
    throw new Error("Could not prepare the photo. Try a different image.");
  }
  return new File([blob], `${baseName(file, "photo")}.jpg`, {
    type: "image/jpeg",
  });
}

/**
 * Downscales a logo to at most 512 px on the long edge, keeping transparency:
 * WebP where the browser can encode it, otherwise PNG. Never JPEG, which
 * would put a solid background behind the logo.
 */
export async function resizeLogo(file: File): Promise<File> {
  const canvas = await drawScaled(
    file,
    LOGO_MAX_EDGE_PX,
    "This browser cannot read that logo. Use a PNG, JPEG or WebP image."
  );
  // Browsers that cannot encode WebP hand back a PNG instead.
  let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
  if (blob && blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/png");
  }
  if (!blob) {
    throw new Error("Could not prepare the logo. Try a different image.");
  }
  const extension = blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `${baseName(file, "logo")}.${extension}`, {
    type: blob.type,
  });
}
