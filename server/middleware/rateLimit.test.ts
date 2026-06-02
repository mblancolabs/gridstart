import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { createLimiter } from "./rateLimit";

describe("Rate limiting middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests within limit", async () => {
    const limiter = createLimiter({ windowMs: 60000, max: 5, name: "test" });
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const limiter = createLimiter({ windowMs: 60000, max: 2, name: "test" });
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/limited", (c) => c.json({ ok: true }));

    const res1 = await app.request("/limited");
    expect(res1.status).toBe(200);

    const res2 = await app.request("/limited");
    expect(res2.status).toBe(200);

    const res3 = await app.request("/limited");
    expect(res3.status).toBe(429);
    const body = await res3.json();
    expect(body.error).toBe("Too Many Requests");
  });

  it("returns 429 with Retry-After header when exceeded", async () => {
    const limiter = createLimiter({ windowMs: 60000, max: 2, name: "test" });
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test");
    await app.request("/test");
    const res = await app.request("/test");

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeDefined();
    const body = await res.json();
    expect(body.error).toBe("Too Many Requests");
    expect(body.retryAfter).toBeLessThanOrEqual(60);
  });

  it("rate limiters are distinct instances", async () => {
    const { generalApiLimiter, preferencesLimiter, exportLimiter } = await import("./rateLimit");
    expect(generalApiLimiter).not.toBe(preferencesLimiter);
    expect(generalApiLimiter).not.toBe(exportLimiter);
    expect(exportLimiter).not.toBe(preferencesLimiter);
  });

  it("sets rate limit headers on response", async () => {
    const limiter = createLimiter({ windowMs: 60000, max: 100, name: "test" });
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.headers.get("x-ratelimit-limit")).toBe("100");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("99");
    expect(res.headers.get("x-ratelimit-reset")).toBeDefined();
  });
});

describe("parseEnvNumber", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses fallback when env var is not set", async () => {
    delete process.env.RATE_LIMIT_WINDOW_MS;
    const { generalApiLimiter } = await import("./rateLimit");
    expect(generalApiLimiter).toBeDefined();
  });
});
