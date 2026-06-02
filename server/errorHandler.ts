import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { AppError } from "./errors";
import * as logger from "./logger";

export function errorHandler(err: Error, c: Context): Response {
  const isProduction = process.env.NODE_ENV === "production";
  const requestId = c.get("requestId") as string | undefined;
  const rawStatus: number =
    err instanceof AppError
      ? err.status
      : typeof err === "object" && err !== null && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
  const status = rawStatus as StatusCode;

  let message: string;
  let errorId: string | undefined;
  const reqPath = c.req.path;

  if (status >= 500) {
    errorId = isProduction ? crypto.randomUUID() : undefined;
    message = isProduction ? "Internal Server Error" : err instanceof Error ? err.message : "Internal Server Error";
    logger.error(err, "Internal server error", { requestId, status, errorId, path: reqPath });
  } else if (err instanceof AppError && err.exposeMessage) {
    message = err.message;
    logger.warn("Handled client error", { requestId, status });
  } else {
    message = err instanceof Error ? err.message : "Unexpected error";
    logger.warn("Handled client error", { requestId, status });
  }

  const payload: { message: string; errorId?: string; stack?: string } = { message };
  if (errorId) payload.errorId = errorId;
  if (!isProduction && err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }

  c.status(status);
  return c.json(payload);
}
