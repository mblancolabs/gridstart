import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { serveStaticAsset } from "./static";

describe("serveStaticAsset", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 when ASSETS binding is not available", async () => {
    const app = new Hono();
    app.get("/*", serveStaticAsset);

    const res = await app.request("/some/path", {}, {});
    expect(res.status).toBe(404);
  });

  it("serves assets from ASSETS.fetch for root path", async () => {
    const mockAssets = {
      fetch: vi.fn().mockResolvedValue(new Response("index html", { status: 200 })),
    };
    const app = new Hono();
    app.get("/*", serveStaticAsset);

    const res = await app.request("http://example.com/", {}, { ASSETS: mockAssets });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("index html");
  });

  it("serves assets from ASSETS.fetch for known paths", async () => {
    const mockAssets = {
      fetch: vi.fn().mockResolvedValue(new Response("asset content", { status: 200 })),
    };
    const app = new Hono();
    app.get("/*", serveStaticAsset);

    const res = await app.request("http://example.com/assets/style.css", {}, { ASSETS: mockAssets });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("asset content");
  });

  it("falls back to app.html when ASSETS returns 404", async () => {
    const mockAssets = {
      fetch: vi
        .fn()
        .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
        .mockResolvedValueOnce(new Response("app html", { status: 200 })),
    };
    const app = new Hono();
    app.get("/*", serveStaticAsset);

    const res = await app.request("http://example.com/unknown/path", {}, { ASSETS: mockAssets });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("app html");
    expect(mockAssets.fetch).toHaveBeenCalledTimes(2);
  });
});
