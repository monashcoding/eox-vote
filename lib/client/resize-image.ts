const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Downscales a photo to at most 1600 px on the long edge and re-encodes it as
 * JPEG (quality 0.85). EXIF orientation is applied to the pixels and the
 * metadata is dropped. Throws an Error with a user-facing message when the
 * browser cannot decode the file (for example HEIC on most desktop browsers).
 */
export async function resizeImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "This browser cannot read that photo. Try a JPEG or PNG image instead."
    );
  }

  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser cannot process photos.");
    }
    context.drawImage(bitmap, 0, 0, width, height);

    // Executor form on purpose: Promise.withResolvers is missing on iOS < 17.4,
    // and this runs on attendees' phones.
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) {
      throw new Error("Could not prepare the photo. Try a different image.");
    }

    const baseName = file.name.replace(/\.[^.]*$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
