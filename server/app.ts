import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrfProtection } from "./csrf";
import { errorHandler } from "./errorHandler";
import { requestComplete } from "./logger";
import { generalApiLimiter } from "./middleware/rateLimit";
import { getProductionCsp, setSecurityHeaders } from "./security-headers";

export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: Fetcher;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
  CSRF_SECRET?: string;
  REDIS_URL?: string;
  REDIS_TOKEN?: string;
  CACHE_TTL?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;
  EXPORT_RATE_LIMIT_WINDOW_MS?: string;
  EXPORT_RATE_LIMIT_MAX?: string;
  STATIC_RATE_LIMIT_WINDOW_MS?: string;
  STATIC_RATE_LIMIT_MAX?: string;
  [key: string]: unknown;
}

export interface Variables {
  requestId: string;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const isProduction = process.env.NODE_ENV === "production";
const devCspOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

const corsOrigin = isProduction
  ? (process.env.CORS_ORIGIN as string | undefined)
  : devCspOrigin;

if (corsOrigin) {
  app.use(
    "/api/*",
    cors({
      origin: corsOrigin,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
      credentials: false,
      maxAge: 86400,
    }),
  );
}

app.use("*", async (c, next) => {
  await next();
  setSecurityHeaders(c.res.headers);
  c.res.headers.set("Cache-Control", "private, no-store");

  const csp = isProduction
    ? getProductionCsp()
    : [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${devCspOrigin}`,
        "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
        "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com",
        "img-src 'self' data:",
        `connect-src 'self' https://api.fontshare.com ${devCspOrigin} ${devCspOrigin.replace(/^https?:/, "ws:")}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; ");
  c.res.headers.set("Content-Security-Policy", csp);
});

app.use("/api/*", csrfProtection);
app.use("/api/*", generalApiLimiter);

app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.res.headers.set("X-Request-Id", requestId);
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  if (c.req.path.startsWith("/api")) {
    requestComplete(requestId, c.res.status, duration);
  }
});

app.get("/health", (c) => c.json({ status: "ok" }));

const { registerRoutes } = await import("./routes");
registerRoutes(app);

app.onError(errorHandler);

export default app;
