import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readBodyWithLimit } from "./body-limit.ts";

function streamOf(chunks: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
    cancel() {
      onCancel?.();
    },
  });
}

function requestWith(
  body: ReadableStream<Uint8Array> | null,
  contentLength: string | null
): Request {
  // Request normalises headers, so build a stand-in with exact control.
  const headers = new Headers();
  if (contentLength !== null) headers.set("content-length", contentLength);
  return { headers, body } as unknown as Request;
}

describe("readBodyWithLimit", () => {
  it("returns the body when it fits", async () => {
    const request = requestWith(
      streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]),
      "3"
    );
    assert.deepEqual(await readBodyWithLimit(request, 10), new Uint8Array([1, 2, 3]));
  });

  it("rejects a missing content-length without reading", async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 }
    );
    assert.equal(await readBodyWithLimit(requestWith(body, null), 10), null);
    assert.equal(pulled, false);
  });

  it("rejects a malformed content-length", async () => {
    assert.equal(await readBodyWithLimit(requestWith(streamOf([]), "abc"), 10), null);
    assert.equal(await readBodyWithLimit(requestWith(streamOf([]), "-1"), 10), null);
  });

  it("rejects a declared length above the limit", async () => {
    assert.equal(await readBodyWithLimit(requestWith(streamOf([]), "11"), 10), null);
  });

  it("aborts a stream that grows past the limit despite a small header", async () => {
    let cancelled = false;
    const chunks = Array.from({ length: 100 }, () => new Uint8Array(4));
    const request = requestWith(streamOf(chunks, () => (cancelled = true)), "4");
    assert.equal(await readBodyWithLimit(request, 10), null);
    assert.equal(cancelled, true);
  });

  it("returns an empty body when there is none", async () => {
    assert.deepEqual(await readBodyWithLimit(requestWith(null, "0"), 10), new Uint8Array(0));
  });
});
