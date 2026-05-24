import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";

describe("Rate limiting middleware", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    vi.clearAllMocks();
  });

  it("allows requests within limit via generalApiLimiter", async () => {
    const { generalApiLimiter } = await import("./rateLimit");
    app.use(generalApiLimiter);
    app.get("/test", (req, res) => res.json({ ok: true }));

    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("allows requests within limit via preferencesLimiter", async () => {
    const { preferencesLimiter } = await import("./rateLimit");
    app.use(preferencesLimiter);
    app.put("/preferences", (req, res) => res.json({ ok: true }));

    const res = await request(app).put("/preferences");
    expect(res.status).toBe(200);
  });

  it("allows requests within limit via exportLimiter", async () => {
    const { exportLimiter } = await import("./rateLimit");
    app.use(exportLimiter);
    app.get("/export", (req, res) => res.json({ ok: true }));

    const res = await request(app).get("/export");
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({ error: "Too Many Requests" });
      },
    });

    app.use(limiter);
    app.get("/limited", (req, res) => res.json({ ok: true }));

    const res1 = await request(app).get("/limited");
    expect(res1.status).toBe(200);

    const res2 = await request(app).get("/limited");
    expect(res2.status).toBe(200);

    const res3 = await request(app).get("/limited");
    expect(res3.status).toBe(429);
    expect(res3.body.error).toBe("Too Many Requests");
  });

  it("rate limiters are distinct instances", async () => {
    const mod = await import("./rateLimit");
    expect(mod.generalApiLimiter).not.toBe(mod.preferencesLimiter);
    expect(mod.generalApiLimiter).not.toBe(mod.exportLimiter);
    expect(mod.preferencesLimiter).not.toBe(mod.exportLimiter);
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

describe("rate limit handler", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 429 with Retry-After header when exceeded using env-configured limiter", async () => {
    process.env.RATE_LIMIT_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    vi.resetModules();
    const { generalApiLimiter } = await import("./rateLimit");

    const app = express();
    app.use(generalApiLimiter);
    app.get("/test", (req, res) => res.json({ ok: true }));

    await request(app).get("/test");
    await request(app).get("/test");
    const res = await request(app).get("/test");

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.body.error).toBe("Too Many Requests");
    expect(res.body.retryAfter).toBe(60);
  });
});
