import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import { csrfProtection, validateCsrfToken, handleCsrfError } from "../middleware/csrf";

describe("CSRF middleware", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
  });

  describe("csrfProtection", () => {
    it("sets CSRF token in cookie and header", async () => {
      app.use(csrfProtection);
      app.get("/test", (req, res) => res.json({ ok: true }));

      const res = await request(app).get("/test");

      expect(res.status).toBe(200);
      expect(res.headers['x-csrf-token']).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toMatch(/csrf-token=/);
    });

    it("reuses existing CSRF token from cookie", async () => {
      app.use(csrfProtection);
      app.get("/test", (req, res) => res.json({ token: (req as any).csrfToken() }));

      // First request to set token
      const res1 = await request(app).get("/test");
      const token1 = res1.body.token;

      // Second request should get same token
      const res2 = await request(app)
        .get("/test")
        .set("Cookie", res1.headers['set-cookie'][0]);

      expect(res2.body.token).toBe(token1);
    });
  });

  describe("validateCsrfToken", () => {
    beforeEach(() => {
      app.use(csrfProtection);
    });

    it("allows GET requests without CSRF token", async () => {
      app.use(validateCsrfToken);
      app.get("/test", (req, res) => res.json({ ok: true }));

      const res = await request(app).get("/test");
      expect(res.status).toBe(200);
    });

    it("allows HEAD requests without CSRF token", async () => {
      app.use(validateCsrfToken);
      app.head("/test", (req, res) => res.json({ ok: true }));

      const res = await request(app).head("/test");
      expect(res.status).toBe(200);
    });

    it("allows OPTIONS requests without CSRF token", async () => {
      app.use(validateCsrfToken);
      app.options("/test", (req, res) => res.json({ ok: true }));

      const res = await request(app).options("/test");
      expect(res.status).toBe(200);
    });

    it("requires CSRF token for POST requests", async () => {
      app.use(validateCsrfToken);
      app.post("/test", (req, res) => res.json({ ok: true }));

      const res = await request(app).post("/test");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("CSRF token validation failed");
    });

    it("accepts valid CSRF token for POST requests", async () => {
      app.use(validateCsrfToken);
      app.post("/test", (req, res) => res.json({ ok: true }));

      // Get token first
      const tokenRes = await request(app).get("/csrf-token");
      const csrfToken = tokenRes.headers['x-csrf-token'];
      const cookie = tokenRes.headers['set-cookie'][0];

      // Use token in POST request
      const res = await request(app)
        .post("/test")
        .set("x-csrf-token", csrfToken)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
    });

    it("rejects mismatched token and cookie", async () => {
      app.use(validateCsrfToken);
      app.post("/test", (req, res) => res.json({ ok: true }));

      const res = await request(app)
        .post("/test")
        .set("x-csrf-token", "invalid-token")
        .set("Cookie", "csrf-token=some-other-token");

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("CSRF token validation failed");
    });

    it("rejects missing header token", async () => {
      app.use(validateCsrfToken);
      app.post("/test", (req, res) => res.json({ ok: true }));

      const tokenRes = await request(app).get("/csrf-token");
      const cookie = tokenRes.headers['set-cookie'][0];

      const res = await request(app)
        .post("/test")
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
    });

    it("rejects missing cookie", async () => {
      app.use(validateCsrfToken);
      app.post("/test", (req, res) => res.json({ ok: true }));

      const res = await request(app)
        .post("/test")
        .set("x-csrf-token", "some-token");

      expect(res.status).toBe(403);
    });
  });

  // Note: handleCsrfError is legacy and not used in current implementation
  // CSRF functionality is tested through route integration tests
});