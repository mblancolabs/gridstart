import { describe, it, expect, vi, beforeAll } from "vitest";
import { Hono } from "hono";
import * as logger from "./logger";

vi.mock("./routes", () => ({
  registerRoutes: vi.fn(),
  fetchICSData: vi.fn(),
}));

let app: Hono;

beforeAll(async () => {
  process.env.CSRF_SECRET = "test-csrf-secret";
  const mod = await import("./app");
  app = mod.default;
});

describe("createApp", () => {
  it("sets request ID header on every response", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeDefined();
    expect(typeof res.headers.get("x-request-id")).toBe("string");
  });

  it("sets security headers", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toBe("geolocation=(), microphone=(), camera=()");
  });

  it("sets Cache-Control on all responses", async () => {
    const res = await app.request("/api/series");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
  });

  it("sets CORS origin header when Origin header matches", async () => {
    const res = await app.request("http://localhost:5173/api/series", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("sets CSRF cookie and token on GET and validates on POST", async () => {
    const getRes = await app.request("/api/series");
    const setCookie = getRes.headers.get("set-cookie") || "";
    const csrfToken = getRes.headers.get("x-csrf-token") as string;
    expect(setCookie).toContain("csrf-token=");
    expect(csrfToken).toBeTruthy();

    const cookieValue = setCookie.split(";")[0];
    const res = await app.request("/api/series", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookieValue,
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ foo: "bar" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects POST without CSRF token", async () => {
    const res = await app.request("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("uses production CSP directives when NODE_ENV=production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.CSRF_SECRET = "test-csrf-secret";
    process.env.NODE_ENV = "production";
    vi.resetModules();
    const prodMod = await import("./app");
    const res = await prodMod.default.request("/health");
    expect(res.headers.get("content-security-policy")).toBeDefined();
    const csp = res.headers.get("content-security-policy") as string;
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("fontshare");
    expect(csp).not.toContain("localhost");
    process.env.NODE_ENV = originalEnv;
  });

  it("logs API request completion to logger", async () => {
    const spy = vi.spyOn(logger, "requestComplete").mockImplementation(() => {});
    await app.request("/api/series");
    expect(spy).toHaveBeenCalledOnce();
    const callArgs = spy.mock.calls[0];
    expect(typeof callArgs[0]).toBe("string");
    expect(typeof callArgs[1]).toBe("number");
    spy.mockRestore();
  });

  it("does not log non-API requests", async () => {
    const spy = vi.spyOn(logger, "requestComplete").mockImplementation(() => {});
    await app.request("/health");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
