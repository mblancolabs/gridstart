import app from "./app";
import type { Env } from "./app";
import { setSecurityHeaders } from "./security-headers";

export default {
  async fetch(request: Request, env: Env, ctx: import("hono").Context['executionCtx']): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api") || url.pathname === "/health" || url.pathname.startsWith("/export.ics")) {
      return app.fetch(request, env, ctx);
    }

    const asset = await env.ASSETS.fetch(request);
    const assetHeaders = new Headers(asset.headers);
    setSecurityHeaders(assetHeaders);
    if (asset.status !== 404) return new Response(asset.body, { ...asset, headers: assetHeaders });

    const urlPath = url.pathname;
    if (urlPath === "/" || urlPath === "/index.html") {
      const index = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request));
      const indexHeaders = new Headers(index.headers);
      setSecurityHeaders(indexHeaders);
      return new Response(index.body, { ...index, headers: indexHeaders });
    }

    const appRes = await env.ASSETS.fetch(new Request(`${url.origin}/app.html`, request));
    const appHeaders = new Headers(appRes.headers);
    setSecurityHeaders(appHeaders);
    return new Response(appRes.body, { ...appRes, headers: appHeaders });
  },
};
