import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Express } from "express";
import { createServer, type Server } from "http";
import request from "supertest";

vi.mock("vite", () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
  createServer: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: () => "test-id-123",
}));

vi.mock("../vite.config", () => ({
  default: {},
}));

vi.mock("./utils", () => ({
  validateFilePath: vi.fn().mockReturnValue(true),
}));

vi.mock("./middleware/rateLimit", () => ({
  staticLimiter: (() => {
    const m = (req: any, res: any, next: any) => next();
    return m;
  })(),
}));

const mockHtml = '<html><head></head><body><script src="/src/main.tsx"></script></body></html>';

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(mockHtml),
  },
  default: {
    promises: {
      readFile: vi.fn().mockResolvedValue(mockHtml),
    },
  },
}));

describe("setupVite", () => {
  let app: Express;
  let server: Server;
  let mockVite: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    server = createServer(app);

    mockVite = {
      middlewares: (req: any, res: any, next: any) => next(),
      transformIndexHtml: vi.fn().mockImplementation((url: string, html: string) =>
        Promise.resolve(html.replace("</head>", '<meta test="true"></head>')),
      ),
      ssrFixStacktrace: vi.fn(),
    };
  });

  it("creates Vite dev server with correct config", async () => {
    const createViteServerMock = (await import("vite")).createServer as any;
    createViteServerMock.mockResolvedValue(mockVite);

    const { setupVite } = await import("./vite");

    await setupVite(server, app);

    expect(createViteServerMock).toHaveBeenCalledOnce();
    const config = createViteServerMock.mock.calls[0][0];
    expect(config.appType).toBe("custom");
    expect(config.server.middlewareMode).toBe(true);
  });

  it("renders HTML via catch-all route handler", async () => {
    const createViteServerMock = (await import("vite")).createServer as any;
    createViteServerMock.mockResolvedValue(mockVite);

    const { setupVite } = await import("./vite");
    await setupVite(server, app);

    const res = await request(app).get("/some-page");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("src=\"/src/main.tsx?v=test-id-123\"");
    expect(mockVite.transformIndexHtml).toHaveBeenCalledOnce();
  });

  it("calls next with error when template file path is invalid", async () => {
    const utils = await import("./utils");
    (utils.validateFilePath as any).mockReturnValue(false);

    const createViteServerMock = (await import("vite")).createServer as any;
    createViteServerMock.mockResolvedValue(mockVite);

    const { setupVite } = await import("./vite");
    await setupVite(server, app);

    const res = await request(app).get("/bad-path");
    expect(res.status).toBe(500);
    expect(mockVite.ssrFixStacktrace).toHaveBeenCalledOnce();
  });
});
