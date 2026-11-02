export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * `ApiError.status` when no response arrived at all (offline, server down,
 * request blocked). No HTTP response has status 0, so callers that branch on
 * real statuses (401, 404, 409, 503) never match it.
 */
export const NETWORK_ERROR_STATUS = 0;

const NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);

  // Auto-set Content-Type for JSON strings if not already set and not FormData
  if (
    init?.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      cache: "no-store",
      headers,
    });
  } catch (err: unknown) {
    // fetch rejects with a TypeError ("Failed to fetch") on network failure;
    // an abort is a DOMException and passes through unchanged.
    if (err instanceof TypeError) {
      throw new ApiError(NETWORK_ERROR_STATUS, NETWORK_ERROR_MESSAGE);
    }
    throw err;
  }

  if (!res.ok) {
    let errorMessage = res.statusText || "Request failed";
    try {
      const data = (await res.json()) as { error?: string };
      if (data && typeof data.error === "string") {
        errorMessage = data.error;
      }
    } catch {
      // Body was not JSON
    }
    throw new ApiError(res.status, errorMessage);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}
