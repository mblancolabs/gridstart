import { describe, it, expect, vi, beforeEach } from "vitest";
import { errorHandler } from "./errorHandler";
import { Hono } from "hono";
import { BadRequestError } from "./errors";

describe("errorHandler", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns generic production response without stack for unexpected errors", async () => {
    process.env.NODE_ENV = "production";
    const app = new Hono();
    app.get("/test", () => { throw new Error("secret error"); });
    app.onError(errorHandler);

    const res = await app.request("/test");
    const body = await res.json();
    expect(body.message).toBe("Internal Server Error");
    expect(body.errorId).toEqual(expect.any(String));
    expect(body.stack).toBeUndefined();
  });

  it("returns exposed client error details in development", async () => {
    process.env.NODE_ENV = "development";
    const app = new Hono();
    app.get("/test", () => { throw new BadRequestError("Invalid series IDs"); });
    app.onError(errorHandler);

    const res = await app.request("/test");
    const body = await res.json();
    expect(body.message).toBe("Invalid series IDs");
    expect(body.errorId).toBeUndefined();
    expect(body.stack).toEqual(expect.any(String));
  });

  it("handles non-AppError errors with a status property", async () => {
    process.env.NODE_ENV = "development";
    const app = new Hono();
    app.get("/test", () => {
      const err = new Error("Not found");
      (err as Record<string, unknown>).status = 404;
      throw err;
    });
    app.onError(errorHandler);

    const res = await app.request("/test");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe("Not found");
  });
});
