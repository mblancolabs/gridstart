import { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { AppError } from "./errors";
import * as logger from "./logger";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === "production";
  const requestId = req.requestId as string | undefined;
  const status =
    err instanceof AppError
      ? err.status
      : typeof err === "object" && err !== null && "status" in err && typeof (err as any).status === "number"
        ? (err as any).status
        : 500;

  let message: string;
  let errorId: string | undefined;

  if (status >= 500) {
    errorId = isProduction ? randomUUID() : undefined;
    message = isProduction ? "Internal Server Error" : err instanceof Error ? err.message : "Internal Server Error";
    logger.error(err, "Internal server error", { requestId, status, errorId });
  } else if (err instanceof AppError && err.exposeMessage) {
    message = err.message;
    logger.warn("Handled client error", { requestId, status });
  } else {
    message = err instanceof Error ? err.message : "Unexpected error";
    logger.warn("Handled client error", { requestId, status });
  }

  if (res.headersSent) {
    return next(err);
  }

  const payload: { message: string; errorId?: string; stack?: string } = { message };
  if (errorId) payload.errorId = errorId;
  if (!isProduction && err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }

  return res.status(status).json(payload);
}
