import app from "./app";
import type { Env } from "./app";

export default {
  async fetch(request: Request, env: Env, ctx: import("hono").Context['executionCtx']): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api") || url.pathname === "/health") {
      return app.fetch(request, env, ctx);
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    const urlPath = url.pathname;
    if (urlPath === "/" || urlPath === "/index.html") {
      return env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request));
    }

    return env.ASSETS.fetch(new Request(`${url.origin}/app.html`, request));
  },
};
