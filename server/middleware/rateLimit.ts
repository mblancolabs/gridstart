import type { Context, Next } from "hono";
import type { RateLimitStore } from "./rateLimitStore";
import { getRateLimitStore } from "./rateLimitStore";
import * as logger from "../logger";

function readConfigNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const val = source[key];
  if (val === undefined || val === null || val === "") return fallback;
  const parsed = typeof val === "number" ? val : parseInt(String(val), 10);
  return isNaN(parsed) ? fallback : parsed;
}

interface LimiterDefinition {
  windowMsKey: string;
  windowMsDefault: number;
  maxKey: string;
  maxDefault: number;
  name: string;
}

function getStoreType(): string {
  const redisUrl = process.env.REDIS_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;
  return redisUrl && redisToken ? "redis" : "memory";
}

const loggedLimiters = new Set<string>();

export function createLimiter(definition: LimiterDefinition, store?: RateLimitStore) {
  const resolvedStore = store ?? getRateLimitStore();

  return async function limiter(c: Context, next: Next): Promise<Response | void> {
    const bindings = ((c.env ?? {}) as Record<string, unknown>);

    const windowMs = readConfigNumber(bindings, definition.windowMsKey, definition.windowMsDefault);
    const max = readConfigNumber(bindings, definition.maxKey, definition.maxDefault);
    const bypassKey =
      (typeof bindings.DAST_BYPASS_KEY === "string" ? bindings.DAST_BYPASS_KEY : undefined) ??
      process.env.DAST_BYPASS_KEY;

    if (!loggedLimiters.has(definition.name)) {
      loggedLimiters.add(definition.name);
      logger.info("Rate limiter config resolved", {
        limiter: definition.name,
        windowMs,
        max,
        storeType: store ? "test" : getStoreType(),
      });
    }

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
  windowMsKey: "RATE_LIMIT_WINDOW_MS",
  windowMsDefault: 15 * 60 * 1000,
  maxKey: "RATE_LIMIT_MAX",
  maxDefault: 100,
  name: "general-api",
});

export const exportLimiter = createLimiter({
  windowMsKey: "EXPORT_RATE_LIMIT_WINDOW_MS",
  windowMsDefault: 60 * 60 * 1000,
  maxKey: "EXPORT_RATE_LIMIT_MAX",
  maxDefault: 10,
  name: "export-api",
});

export const staticLimiter = createLimiter({
  windowMsKey: "STATIC_RATE_LIMIT_WINDOW_MS",
  windowMsDefault: 15 * 60 * 1000,
  maxKey: "STATIC_RATE_LIMIT_MAX",
  maxDefault: 1000,
  name: "static",
});
