import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { api, ApiError, NETWORK_ERROR_STATUS } from "./api.ts";

const realFetch = globalThis.fetch;

function stubFetch(impl: () => Promise<Response>): void {
  globalThis.fetch = impl as typeof fetch;
}

describe("api", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("turns a network failure into a friendly ApiError", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await assert.rejects(api("/api/state"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, NETWORK_ERROR_STATUS);
      assert.equal(
        err.message,
        "Could not reach the server. Check your connection and try again."
      );
      return true;
    });
  });

  it("passes an abort through unchanged", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    stubFetch(() => Promise.reject(abort));
    await assert.rejects(api("/api/state"), (err: unknown) => err === abort);
  });

  it("keeps the HTTP status and server message", async () => {
    stubFetch(() =>
      Promise.resolve(
        Response.json({ error: "Voting has closed" }, { status: 409 })
      )
    );
    await assert.rejects(api("/api/votes/x", { method: "PUT" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 409);
      assert.equal(err.message, "Voting has closed");
      return true;
    });
  });
});
