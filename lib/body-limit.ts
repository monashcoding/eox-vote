/**
 * Reads a request body of at most `limit` bytes. Returns null, without
 * buffering the rest, when `content-length` is missing, malformed or above the
 * limit, or when the stream turns out longer than the limit.
 */
export async function readBodyWithLimit(
  request: Request,
  limit: number
): Promise<Uint8Array<ArrayBuffer> | null> {
  const header = request.headers.get("content-length");
  if (header === null || !/^\d+$/.test(header) || Number(header) > limit) {
    return null;
  }
  if (!request.body) {
    return new Uint8Array(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
