import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

function parseEnvNumber(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeLogValue(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      return code <= 0x1f || code === 0x7f ? " " : c;
    })
    .join("");
}

function encodeLogValue(value: string): string {
  return JSON.stringify(sanitizeLogValue(value));
}

function createLimiter({ windowMs, max, name }: { windowMs: number; max: number; name: string }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      const ip = encodeLogValue(req.ip ?? "-");
      const method = encodeLogValue(req.method);
      const originalUrl = encodeLogValue(req.originalUrl);
      const limiterName = encodeLogValue(name);

      console.warn(
        `[rate-limit] ${ip} ${method} ${originalUrl} exceeded ${max} requests in ${windowMs / 1000}s (${limiterName})`,
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: retryAfterSeconds,
      });
    },
  });
}

const generalWindowMs = parseEnvNumber("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);
const generalMax = parseEnvNumber("RATE_LIMIT_MAX", 100);
const exportWindowMs = parseEnvNumber("EXPORT_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000);
const exportMax = parseEnvNumber("EXPORT_RATE_LIMIT_MAX", 10);
const preferencesWindowMs = parseEnvNumber("PREFERENCES_RATE_LIMIT_WINDOW_MS", 5 * 60 * 1000);
const preferencesMax = parseEnvNumber("PREFERENCES_RATE_LIMIT_MAX", 20);
const staticWindowMs = parseEnvNumber("STATIC_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);
const staticMax = parseEnvNumber("STATIC_RATE_LIMIT_MAX", 1000);

export const generalApiLimiter = createLimiter({
  windowMs: generalWindowMs,
  max: generalMax,
  name: "general-api",
});

export const preferencesLimiter = createLimiter({
  windowMs: preferencesWindowMs,
  max: preferencesMax,
  name: "preferences-update",
});

export const exportLimiter = createLimiter({
  windowMs: exportWindowMs,
  max: exportMax,
  name: "export-api",
});

export const staticLimiter = createLimiter({
  windowMs: staticWindowMs,
  max: staticMax,
  name: "static",
});
