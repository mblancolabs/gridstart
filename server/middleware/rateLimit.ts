import type { Context, Next } from "hono";
import type { RateLimitStore } from "./rateLimitStore";
import { getRateLimitStore } from "./rateLimitStore";

function parseEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

interface LimiterConfig {
  windowMs: number;
  max: number;
  name: string;
}

export function createLimiter(config: LimiterConfig, store?: RateLimitStore) {
  const { windowMs, max } = config;
  const resolvedStore = store ?? getRateLimitStore();
  const bypassKey = process.env.DAST_BYPASS_KEY;

  return async function limiter(c: Context, next: Next): Promise<Response | void> {
    if (bypassKey && c.req.header("x-dast-bypass") === bypassKey) {
      await next();
      return;
    }

    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";

    const { count, resetAt } = await resolvedStore.increment(ip, windowMs);

    if (count > max) {
      const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
      c.status(429);
      c.header("Retry-After", String(retryAfterSeconds));
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
      return c.json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: retryAfterSeconds,
      });
    }

    await next();

    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, max - count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  };
}

export const generalApiLimiter = createLimiter({
  windowMs: parseEnvNumber("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: parseEnvNumber("RATE_LIMIT_MAX", 100),
  name: "general-api",
});

export const exportLimiter = createLimiter({
  windowMs: parseEnvNumber("EXPORT_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000),
  max: parseEnvNumber("EXPORT_RATE_LIMIT_MAX", 10),
  name: "export-api",
});

export const staticLimiter = createLimiter({
  windowMs: parseEnvNumber("STATIC_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: parseEnvNumber("STATIC_RATE_LIMIT_MAX", 1000),
  name: "static",
});
