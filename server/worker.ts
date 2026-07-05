import app from "./app";
import type { Env } from "./app";
import type { KVNamespace } from "@cloudflare/workers-types";
import { getProductionCsp, setSecurityHeaders } from "./security-headers";
import { setKvNamespace } from "./cache";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json; charset=utf-8",
};

function inferContentType(pathname: string): string | null {
  const ext = pathname.match(/\.[\w.]+$/)?.[0];
  return ext ? MIME_TYPES[ext] ?? null : null;
}

function ensureContentType(headers: Headers, pathname: string): void {
  const existing = headers.get("Content-Type");
  if (!existing || !existing.trim()) {
    const inferred = inferContentType(pathname);
    if (inferred) headers.set("Content-Type", inferred);
  }
}

function isHtml(pathname: string): boolean {
  return pathname === "/" || pathname.endsWith(".html");
}

function isServiceWorker(pathname: string): boolean {
  return pathname === "/sw.js";
}

function isHashedAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/assets/") ||
    /[a-f0-9]{8,}\.(js|css|woff2?|png|svg)$/.test(pathname)
  );
}

async function serveAsset(url: URL, request: Request, env: Env): Promise<Response> {
  const asset = await env.ASSETS.fetch(new Request(url, request));
  const headers = new Headers(asset.headers);
  ensureContentType(headers, url.pathname);
  const isHtmlPage = isHtml(url.pathname) || headers.get("Content-Type")?.startsWith("text/html");
  if (isServiceWorker(url.pathname)) {
    headers.set("Cache-Control", "no-cache");
  } else if (isHashedAsset(url.pathname)) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (isHtmlPage) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  } else {
    headers.set("Cache-Control", "private, max-age=3600");
  }
  setSecurityHeaders(headers);
  if (isHtmlPage) {
    headers.set("Content-Security-Policy", getProductionCsp());
  }
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: import("hono").Context['executionCtx']): Promise<Response> {
    const url = new URL(request.url);

    if (env.CACHE_KV) {
      setKvNamespace(env.CACHE_KV as KVNamespace);
    }

    if (url.pathname.startsWith("/api") || url.pathname === "/health" || url.pathname.startsWith("/export.ics")) {
      return app.fetch(request, env, ctx);
    }

    const asset = await serveAsset(url, request, env);
    if (asset.status !== 404) return asset;

    const urlPath = url.pathname;
    if (urlPath === "/" || urlPath === "/index.html") {
      return serveAsset(new URL(`${url.origin}/index.html`), request, env);
    }

    return serveAsset(new URL(`${url.origin}/app.html`), request, env);
  },
};
