import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { createLimiter, generalApiLimiter } from "./rateLimit";
import { MemoryRateLimitStore, clearRateLimitStore } from "./rateLimitStore";
import * as logger from "../logger";

function testLimiter(store: MemoryRateLimitStore, def: Partial<{ windowMs: number; max: number; name: string }> = {}) {
  return createLimiter(
    {
      windowMsKey: "WINDOW_MS",
      windowMsDefault: def.windowMs ?? 60000,
      maxKey: "MAX",
      maxDefault: def.max ?? 5,
      name: def.name ?? "test",
    },
    store,
  );
}

describe("Rate limiting middleware", () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStore();
    store = new MemoryRateLimitStore();
  });

  it("allows requests within limit", async () => {
    const limiter = testLimiter(store);
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const limiter = testLimiter(store, { max: 2 });
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
    const limiter = testLimiter(store, { max: 2 });
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
    clearRateLimitStore();
    const { exportLimiter, staticLimiter } = await import("./rateLimit");
    expect(generalApiLimiter).not.toBe(exportLimiter);
    expect(generalApiLimiter).not.toBe(staticLimiter);
    expect(exportLimiter).not.toBe(staticLimiter);
  });

  it("sets rate limit headers on response", async () => {
    const limiter = testLimiter(store, { max: 100 });
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.headers.get("x-ratelimit-limit")).toBe("100");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("99");
    expect(res.headers.get("x-ratelimit-reset")).toBeDefined();
  });

  it("resolves windowMs/max from c.env bindings, not just defaults", async () => {
    const limiter = createLimiter(
      { windowMsKey: "RATE_LIMIT_WINDOW_MS", windowMsDefault: 900000, maxKey: "RATE_LIMIT_MAX", maxDefault: 100, name: "env-test" },
      store,
    );
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/limited", (c) => c.json({ ok: true }));

    // 5000 requests allowed per window when binding is set
    const env = { RATE_LIMIT_MAX: "5000", RATE_LIMIT_WINDOW_MS: "600000" };
    let res: Response | null = null;
    for (let i = 0; i < 5000; i++) {
      res = await app.request("/limited", {}, env);
      if (res.status !== 200) break;
    }
    expect(res!.status).toBe(200);
    expect(res!.headers.get("x-ratelimit-limit")).toBe("5000");
  });

  it("honors DAST bypass from c.env bindings", async () => {
    const limiter = createLimiter(
      { windowMsKey: "WINDOW_MS", windowMsDefault: 60000, maxKey: "MAX", maxDefault: 1, name: "bypass-test" },
      store,
    );
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/ok", (c) => c.json({ ok: true }));

    const env = { DAST_BYPASS_KEY: "secret-hex" };
    const res = await app.request("/ok", { headers: { "x-dast-bypass": "secret-hex" } }, env);
    expect(res.status).toBe(200);
  });
});

describe("limiter config fallback", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses default max when no env var or binding is present", async () => {
    delete process.env.RATE_LIMIT_WINDOW_MS;
    clearRateLimitStore();
    const app = new Hono();
    app.use("/*", generalApiLimiter);
    app.get("/limited", (c) => c.json({ ok: true }));

    const res = await app.request("/limited");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe("100");
  });

  it("falls back to process.env when binding is absent", async () => {
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    process.env.RATE_LIMIT_MAX = "5";
    clearRateLimitStore();
    const app = new Hono();
    app.use("/*", generalApiLimiter);
    app.get("/limited", (c) => c.json({ ok: true }));

    const ipHeader = { "cf-connecting-ip": "10.9.9.9" };
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/limited", { headers: ipHeader }, {});
      expect(res.status).toBe(200);
    }
    const res6 = await app.request("/limited", { headers: ipHeader }, {});
    expect(res6.status).toBe(429);
    expect(res6.headers.get("x-ratelimit-limit")).toBe("5");
  });

  it("prefers c.env binding over process.env", async () => {
    process.env.RATE_LIMIT_MAX = "5";
    const limiter = createLimiter(
      { windowMsKey: "RATE_LIMIT_WINDOW_MS", windowMsDefault: 60000, maxKey: "RATE_LIMIT_MAX", maxDefault: 100, name: "precedence-test" },
      new MemoryRateLimitStore(),
    );
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/limited", (c) => c.json({ ok: true }));

    const res = await app.request("/limited", {}, { RATE_LIMIT_MAX: "5000" });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe("5000");
  });

  it("logs resolved config once per isolate", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const limiter = testLimiter(new MemoryRateLimitStore(), { name: "log-once-test" });
    const app = new Hono();
    app.use("/*", limiter);
    app.get("/ok", (c) => c.json({ ok: true }));

    await app.request("/ok");
    await app.request("/ok");

    const limiterLogs = infoSpy.mock.calls.filter(([msg]) => msg === "Rate limiter config resolved");
    expect(limiterLogs.length).toBe(1);
    infoSpy.mockRestore();
  });
});
