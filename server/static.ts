import type { Context } from "hono";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export async function serveStaticAsset(c: Context): Promise<Response> {
  const env = c.env as Record<string, unknown> | undefined;
  const ASSETS = env?.ASSETS as Fetcher | undefined;
  if (!ASSETS) {
    return c.text("Not Found", 404);
  }

  const url = new URL(c.req.url);
  const path = url.pathname;

  if (path === "/" || path === "/index.html") {
    return ASSETS.fetch(new Request(`${url.origin}/index.html`, c.req.raw));
  }

  const asset = await ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) return asset;

  return ASSETS.fetch(new Request(`${url.origin}/app.html`, c.req.raw));
}
