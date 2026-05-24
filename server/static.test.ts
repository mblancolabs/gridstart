import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import path from "path";
import fs from "fs";

vi.mock("./middleware/rateLimit", () => ({
  staticLimiter: (() => {
    const m = (req: any, res: any, next: any) => next();
    return m;
  })(),
}));

describe("serveStatic", () => {
  const publicDir = path.resolve(__dirname, "public");

  beforeAll(() => {
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, "index.html"), "<html><body>GridStart</body></html>");
  });

  afterAll(() => {
    if (fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when dist directory does not exist", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const { serveStatic } = await import("./static");
    const app = express();

    expect(() => serveStatic(app)).toThrow("Could not find the build directory");
  });

  it("serves index.html for unknown paths (SPA fallback)", async () => {
    const { serveStatic } = await import("./static");
    const app = express();
    serveStatic(app);

    const res = await request(app).get("/some/unknown/path");
    expect(res.status).toBe(200);
    expect(res.text).toContain("GridStart");
  });
});
