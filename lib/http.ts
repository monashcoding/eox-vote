import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export type RouteHandler<TContext = unknown> = (
  request: Request,
  context: TContext
) => Promise<Response>;

function isNextInternalError(err: unknown): boolean {
  if (err && typeof err === "object" && "digest" in err) {
    const digest = err.digest;
    if (typeof digest === "string") {
      return digest === "HANGING_PROMISE_REJECTION" || digest.startsWith("NEXT_");
    }
  }
  return false;
}

export function handleRoute<TContext = unknown>(
  handler: RouteHandler<TContext>
): RouteHandler<TContext> {
  return async (request: Request, context: TContext): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (err: unknown) {
      if (isNextInternalError(err)) {
        throw err;
      }
      if (err instanceof HttpError) {
        return errorResponse(err.status, err.message);
      }
      if (err instanceof ZodError) {
        const message = err.issues[0]?.message ?? "Invalid request";
        return errorResponse(400, message);
      }
      console.error("Unhandled error in route handler:", err);
      const message =
        err instanceof Error ? err.message : "Internal server error";
      return errorResponse(500, message);
    }
  };
}
