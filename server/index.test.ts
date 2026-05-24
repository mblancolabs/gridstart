import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import * as logger from "./logger";

// Mock serveStatic to avoid directory check during module reload
vi.mock("./static", () => ({
  serveStatic: vi.fn(),
}));

vi.mock("./vite", () => ({
  setupVite: vi.fn(),
}));

describe("createApp", () => {
  let createApp: typeof import("./index").createApp;

  beforeAll(async () => {
    const mod = await import("./index");
    createApp = mod.createApp;
  });

  it("returns an Express app with request ID middleware", async () => {
    const { app } = createApp();
    app.get("/test-route", (_req: any, res: any) => {
      res.json({ ok: true });
    });

    const res = await request(app).get("/test-route");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(typeof res.headers["x-request-id"]).toBe("string");
  });

  it("sets security headers via helmet", async () => {
    const { app } = createApp();
    app.get("/test-route", (_req: any, res: any) => {
      res.json({ ok: true });
    });

    const res = await request(app).get("/test-route");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-xss-protection"]).toBe("0");
  });

  it("sets CORS origin header", async () => {
    const { app } = createApp();
    app.get("/test-route", (_req: any, res: any) => {
      res.json({ ok: true });
    });

    const res = await request(app).get("/test-route");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("parses JSON request bodies", async () => {
    const { app } = createApp();

    app.post("/test-json", (req: any, res: any) => {
      res.json({ received: req.body });
    });

    // First request to get CSRF and session cookies
    const getRes = await request(app).get("/test-json");
    const csrfToken = getRes.headers["x-csrf-token"];
    const cookies = getRes.headers["set-cookie"];

    // POST with both session cookie and CSRF token
    let reqBuilder = request(app)
      .post("/test-json")
      .send({ foo: "bar" })
      .set("Content-Type", "application/json")
      .set("x-csrf-token", csrfToken as string);
    if (cookies) {
      reqBuilder = reqBuilder.set("Cookie", Array.isArray(cookies) ? cookies.join("; ") : cookies);
    }

    const res = await reqBuilder;
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ foo: "bar" });
  });

  it("uses production CSP directives when NODE_ENV=production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const { app } = createApp();
    app.get("/csp-test", (_req: any, res: any) => {
      res.json({ ok: true });
    });

    const res = await request(app).get("/csp-test");
    expect(res.headers["content-security-policy"]).toBeDefined();
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("http://localhost:5173");

    process.env.NODE_ENV = originalEnv;
  });

  it("logs API request completion to logger", async () => {
    const spy = vi.spyOn(logger, "requestComplete").mockImplementation(() => {});
    const { app } = createApp();
    app.get("/api/test", (_req: any, res: any) => {
      res.json({ data: "ok" });
    });

    await request(app).get("/api/test");

    expect(spy).toHaveBeenCalledOnce();
    const callArgs = spy.mock.calls[0];
    expect(callArgs[1]).toBe(200);
    expect(typeof callArgs[0]).toBe("string");
    spy.mockRestore();
  });

  it("does not log non-API requests", async () => {
    const spy = vi.spyOn(logger, "requestComplete").mockImplementation(() => {});
    const { app } = createApp();
    app.get("/health", (_req: any, res: any) => {
      res.json({ ok: true });
    });

    await request(app).get("/health");

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("log", () => {
  it("outputs formatted message to console", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { log } = await import("./index");

    log("test message", "test-source");

    expect(spy).toHaveBeenCalledOnce();
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain("[test-source]");
    expect(output).toContain("test message");
    spy.mockRestore();
  });
});
