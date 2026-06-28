import app from "./app";
import type { Env } from "./app";
import { getProductionCsp, setSecurityHeaders } from "./security-headers";

export default {
  async fetch(request: Request, env: Env, ctx: import("hono").Context['executionCtx']): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api") || url.pathname === "/health" || url.pathname.startsWith("/export.ics")) {
      return app.fetch(request, env, ctx);
    }

    const asset = await env.ASSETS.fetch(request);
    const assetHeaders = new Headers(asset.headers);
    setSecurityHeaders(assetHeaders);
    assetHeaders.set("Content-Security-Policy", getProductionCsp());
    if (asset.status !== 404) return new Response(asset.body, { ...asset, headers: assetHeaders });

    const urlPath = url.pathname;
    if (urlPath === "/" || urlPath === "/index.html") {
      const index = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request));
      const indexHeaders = new Headers(index.headers);
      setSecurityHeaders(indexHeaders);
      indexHeaders.set("Content-Security-Policy", getProductionCsp());
      return new Response(index.body, { ...index, headers: indexHeaders });
    }

    const appRes = await env.ASSETS.fetch(new Request(`${url.origin}/app.html`, request));
    const appHeaders = new Headers(appRes.headers);
    setSecurityHeaders(appHeaders);
    appHeaders.set("Content-Security-Policy", getProductionCsp());
    return new Response(appRes.body, { ...appRes, headers: appHeaders });
  },
};
