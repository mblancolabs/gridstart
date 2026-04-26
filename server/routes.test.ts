import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { errorHandler } from "./errorHandler";

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
});
