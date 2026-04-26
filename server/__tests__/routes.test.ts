import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import { registerRoutes } from "../routes";
import { errorHandler } from "../errorHandler";
import { csrfProtection, validateCsrfToken, handleCsrfError } from "../middleware/csrf";
import cookieParser from "cookie-parser";

describe("routes", () => {
  it("propagates BadRequestError from /api/events through route middleware", async () => {
    const app = express();
    app.use(express.json());

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(errorHandler);

    const res = await request(app)
      .get("/api/events")
      .query({ series: "unknown" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Invalid series IDs: unknown",
      }),
    );
  });

  it("requires CSRF token for PUT /api/preferences", async () => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

    // Add CSRF middleware
    app.use(csrfProtection);

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(handleCsrfError);
    app.use(errorHandler);

    // Try to update preferences without CSRF token
    const res = await request(app)
      .put("/api/preferences")
      .send({ enabledSeries: JSON.stringify(["f1"]) });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("CSRF token validation failed");
  });

  it("accepts valid CSRF token for PUT /api/preferences", async () => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

    // Add CSRF middleware
    app.use(csrfProtection);

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(handleCsrfError);
    app.use(errorHandler);

    // First get a CSRF token by making a request that sets the cookie
    const tokenRes = await request(app).get("/api/csrf-token");
    expect(tokenRes.status).toBe(200);
    const csrfToken = tokenRes.headers['x-csrf-token'];
    expect(csrfToken).toBeDefined();

    // Extract the CSRF token from the cookie
    const cookies = tokenRes.headers['set-cookie'];
    const csrfCookie = cookies.find((cookie: string) => cookie.startsWith('csrf-token='));
    const tokenFromCookie = csrfCookie ? csrfCookie.split('=')[1].split(';')[0] : null;

    // Now try to update preferences with valid CSRF token
    const res = await request(app)
      .put("/api/preferences")
      .set("x-csrf-token", tokenFromCookie)
      .set("Cookie", `csrf-token=${tokenFromCookie}`)
      .send({ enabledSeries: JSON.stringify(["f1"]) });

    // Should succeed (or fail for other reasons, but not CSRF)
    expect(res.status).not.toBe(403);
  });

  it("returns series list from /api/series", async () => {
    const app = express();
    app.use(express.json());

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(errorHandler);

    const res = await request(app).get("/api/series");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("enabled");
  });

  it("validates query parameters for /api/events", async () => {
    const app = express();
    app.use(express.json());

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(errorHandler);

    // Test missing series parameter
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(400);
  });

  it("returns preferences from /api/preferences", async () => {
    const app = express();
    app.use(express.json());

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(errorHandler);

    const res = await request(app).get("/api/preferences");

    expect(res.status).toBe(200);
    // Preferences might be null if not set
    expect(res.body).toBeDefined();
  });

  it("returns CSRF token from /api/csrf-token", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(csrfProtection);

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(errorHandler);

    const res = await request(app).get("/api/csrf-token");

    expect(res.status).toBe(200);
    expect(res.headers['x-csrf-token']).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it("validates query parameters for /api/export.ics", async () => {
    const app = express();
    app.use(express.json());

    const server = createServer(app);
    await registerRoutes(server, app);
    app.use(errorHandler);

    // Test missing series parameter
    const res = await request(app).get("/api/export.ics");
    expect(res.status).toBe(400);
  });
});
