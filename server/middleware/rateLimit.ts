import type { Context, Next } from "hono";

interface LimiterConfig {
  windowMs: number;
  max: number;
  name: string;
}

export function createLimiter(config: LimiterConfig) {
  const { windowMs, max } = config;
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  return async function limiter(c: Context, next: Next): Promise<Response | void> {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();

    let entry = requestCounts.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      requestCounts.set(ip, entry);
    }

    entry.count++;

    c.res.headers.set("X-RateLimit-Limit", String(max));
    c.res.headers.set("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    c.res.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      c.res.headers.set("Retry-After", String(retryAfterSeconds));
      c.status(429);
      return c.json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: retryAfterSeconds,
      });
    }

    await next();
  };
}

export const generalApiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: "general-api",
});

export const exportLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  name: "export-api",
});

export const staticLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  name: "static",
});
