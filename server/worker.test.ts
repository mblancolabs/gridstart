import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAppFetch } = vi.hoisted(() => {
  globalThis.__CONFIG_FEEDS__ = JSON.stringify({
    categories: [{ name: "Test", series: [] }],
  });
  return { mockAppFetch: vi.fn() };
});

vi.mock("./app", () => ({
  default: {
    fetch: mockAppFetch,
  },
}));

type ExecutionCtx = { waitUntil: (p: Promise<unknown>) => void; passThroughOnException: () => void };

const mockCtx: ExecutionCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

import worker from "./worker";

function mockEnv(assetResponse?: Response, opts?: { noAssets?: boolean }): Record<string, unknown> {
  return {
    ASSETS: opts?.noAssets
      ? undefined
      : {
          fetch: vi.fn().mockResolvedValue(
            assetResponse ??
              new Response("asset body", {
                status: 200,
                headers: { "content-type": "text/html" },
              }),
          ),
        },
    NODE_ENV: "production",
  };
}

describe("Worker routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards /api/* requests to the Hono app", async () => {
    mockAppFetch.mockResolvedValue(new Response("api ok", { status: 200 }));
    const env = mockEnv();

    const res = await worker.fetch(new Request("http://example.com/api/series"), env, mockCtx);

    expect(mockAppFetch).toHaveBeenCalledTimes(1);
    const [_request, _env] = mockAppFetch.mock.calls[0];
    expect(new URL(_request.url).pathname).toBe("/api/series");
    expect(_env).toBe(env);
    expect(res.status).toBe(200);
  });

  it("forwards /health to the Hono app", async () => {
    mockAppFetch.mockResolvedValue(new Response("OK", { status: 200 }));
    const res = await worker.fetch(new Request("http://example.com/health"), mockEnv(), mockCtx);
    expect(mockAppFetch).toHaveBeenCalledTimes(1);
    expect(new URL(mockAppFetch.mock.calls[0][0].url).pathname).toBe("/health");
    expect(res.status).toBe(200);
  });

  it("forwards /export.ics requests to the Hono app", async () => {
    mockAppFetch.mockResolvedValue(new Response("ics", { status: 200 }));
    const res = await worker.fetch(new Request("http://example.com/export.ics?series=f1"), mockEnv(), mockCtx);
    expect(mockAppFetch).toHaveBeenCalledTimes(1);
    expect(new URL(mockAppFetch.mock.calls[0][0].url).pathname).toBe("/export.ics");
    expect(res.status).toBe(200);
  });

  it("forwards /api/export.ics to the Hono app", async () => {
    mockAppFetch.mockResolvedValue(new Response("ics", { status: 200 }));
    await worker.fetch(new Request("http://example.com/api/export.ics?series=f1"), mockEnv(), mockCtx);
    expect(mockAppFetch).toHaveBeenCalledTimes(1);
    expect(new URL(mockAppFetch.mock.calls[0][0].url).pathname).toBe("/api/export.ics");
  });

  it("serves static assets via env.ASSETS.fetch", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("script content", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/assets/app.js"), env, mockCtx);

    expect(mockAppFetch).not.toHaveBeenCalled();
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("script content");
  });

  it("serves root path / via index.html", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("index html", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    await worker.fetch(new Request("http://example.com/"), env, mockCtx);

    expect(assetsFetch).toHaveBeenCalledTimes(1);
    const req: Request = assetsFetch.mock.calls[0][0];
    expect(new URL(req.url).pathname).toBe("/");
  });

  it("falls back to app.html on 404 for non-root paths", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response("app html", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/some/deep/path"), env, mockCtx);

    expect(assetsFetch).toHaveBeenCalledTimes(2);
    expect(new URL(assetsFetch.mock.calls[1][0].url).pathname).toBe("/app.html");
    const body = await res.text();
    expect(body).toBe("app html");
  });

  it("retries /index.html when first attempt returns 404", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response("index html", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/index.html"), env, mockCtx);

    expect(assetsFetch).toHaveBeenCalledTimes(2);
    expect(new URL(assetsFetch.mock.calls[1][0].url).pathname).toBe("/index.html");
    expect(res.status).toBe(200);
  });
});

describe("Worker — security headers & CSP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets security headers on static HTML responses", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("html", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/"), env, mockCtx);

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toBe("geolocation=(), microphone=(), camera=()");
  });

  it("applies production CSP on HTML pages", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("html", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/"), env, mockCtx);

    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    const scriptSrc = csp.split(";").find((d: string) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("applies CSP on any .html path", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("html", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/some/page.html"), env, mockCtx);

    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeDefined();
  });

  it("does not apply CSP on non-HTML assets", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    await worker.fetch(new Request("http://example.com/api/series"), env, mockCtx);
    expect(mockAppFetch).toHaveBeenCalled();

    // For a non-HTML static asset:
    mockAppFetch.mockReset();
    const jsFetch = vi.fn().mockResolvedValue(
      new Response("console.log('hi')", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );
    const res2 = await worker.fetch(new Request("http://example.com/app.js"), { ASSETS: { fetch: jsFetch } }, mockCtx);
    expect(res2.headers.get("content-security-policy")).toBeNull();
  });
});

describe("Worker — Cache-Control headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets no-cache for HTML pages", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("html", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };
    const res = await worker.fetch(new Request("http://example.com/"), env, mockCtx);
    expect(res.headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
  });

  it("sets immutable cache for hashed assets in /assets/", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("console.log('hi')", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };
    const res = await worker.fetch(new Request("http://example.com/assets/index-a1b2c3d4.js"), env, mockCtx);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("sets immutable cache for hashed assets outside /assets/ via regex", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("body { color: red; }", {
        status: 200,
        headers: { "content-type": "text/css" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };
    const res = await worker.fetch(new Request("http://example.com/some-chunk.a1b2c3d4.css"), env, mockCtx);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("sets short public cache for other static assets", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };
    const res = await worker.fetch(new Request("http://example.com/manifest.webmanifest"), env, mockCtx);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  it("sets short public cache for non-hashed /app.js", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("console.log('hi')", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };
    const res = await worker.fetch(new Request("http://example.com/app.js"), env, mockCtx);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});

function responseWithoutContentType(body: string, status = 200): Response {
  const res = new Response(body, { status });
  res.headers.delete("Content-Type");
  return res;
}

describe("Worker — Content-Type inference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("infers Content-Type for .js files when missing", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(responseWithoutContentType("code"));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/bundle.js"), env, mockCtx);

    expect(res.headers.get("content-type")).toBe("application/javascript");
  });

  it("infers Content-Type for .css files when missing", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(responseWithoutContentType("styles"));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/styles.css"), env, mockCtx);

    expect(res.headers.get("content-type")).toBe("text/css");
  });

  it("infers Content-Type for .svg files when missing", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(responseWithoutContentType("svg"));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/icon.svg"), env, mockCtx);

    expect(res.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("infers Content-Type for .webmanifest when missing", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(responseWithoutContentType("{}"));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/site.webmanifest"), env, mockCtx);

    expect(res.headers.get("content-type")).toBe("application/manifest+json");
  });

  it("infers Content-Type for .ico when missing", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(responseWithoutContentType(""));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/favicon.ico"), env, mockCtx);

    expect(res.headers.get("content-type")).toBe("image/x-icon");
  });

  it("preserves existing Content-Type from upstream", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("code", {
        status: 200,
        headers: { "content-type": "text/javascript; charset=utf-8" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/bundle.js"), env, mockCtx);

    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  });

  it("does not set Content-Type when extension is unknown", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(responseWithoutContentType("data"));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/file.unknown"), env, mockCtx);

    expect(res.headers.get("content-type")).toBeNull();
  });

  it("does not set Content-Type for paths without extension", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(responseWithoutContentType("data"));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/page"), env, mockCtx);

    expect(res.headers.get("content-type")).toBeNull();
  });
});

describe("Worker — asset not found", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates the upstream status code", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/missing"), env, mockCtx);

    expect(res.status).toBe(404);
  });

  it("returns 404 when app.html is also missing", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const env = { ASSETS: { fetch: assetsFetch } };

    const res = await worker.fetch(new Request("http://example.com/missing"), env, mockCtx);

    expect(res.status).toBe(404);
  });

  it("passes request headers through to ASSETS.fetch", async () => {
    mockAppFetch.mockReset();
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response("html", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const env = { ASSETS: { fetch: assetsFetch } };

    await worker.fetch(
      new Request("http://example.com/", {
        headers: { "accept-language": "en-US", "user-agent": "test" },
      }),
      env,
      mockCtx,
    );

    const assetReq: Request = assetsFetch.mock.calls[0][0];
    expect(assetReq.headers.get("accept-language")).toBe("en-US");
  });
});
