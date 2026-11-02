export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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

  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers,
  });

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
