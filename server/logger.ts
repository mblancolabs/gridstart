import { type Request } from "express";

const isProduction = process.env.NODE_ENV === "production";

function getErrorDetails(err: unknown) {
  if (err instanceof Error) {
    const details: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };

    if (!isProduction && err.stack) {
      details.stack = err.stack;
    }

    return details;
  }

  if (typeof err === "object" && err !== null) {
    return err as Record<string, unknown>;
  }

  return { message: String(err) };
}

function writeLog(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export function info(message: string, meta?: Record<string, unknown>) {
  writeLog("info", message, meta);
}

export function warn(message: string, meta?: Record<string, unknown>) {
  writeLog("warn", message, meta);
}

export function error(err: unknown, message = "Unhandled error", meta?: Record<string, unknown>) {
  const errorMeta = {
    ...(meta ?? {}),
    error: getErrorDetails(err),
  };
  writeLog("error", message, errorMeta);
}

export function requestComplete(requestId: string, statusCode: number, durationMs: number, responseBody?: unknown) {
  const meta: Record<string, unknown> = {
    requestId,
    statusCode,
    durationMs,
  };

  if (responseBody !== undefined) {
    meta.responseBody = responseBody;
  }

  writeLog("info", "Request complete", meta);
}

export function requestStarted(requestId: string, method: string, path: string) {
  writeLog("info", "Request started", {
    requestId,
    method,
    path,
  });
}
