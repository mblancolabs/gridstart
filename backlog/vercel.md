# Plan: Vercel Deployment & Multi-Environment Configuration

## Overview
This document outlines the changes needed to deploy GridStart on Vercel with dev/staging/production environment configurations, and documents what would be required for true multi-node scaling.

## Phase 1 — Completed 2026-05-24

| Change | Files |
|---|---|
| Stateless HMAC-based double-submit CSRF (replaced Lusca + express-session) | `server/csrf.ts` (created), `server/index.ts` (modified) |
| Serverless entry point | `server/vercel.ts` (created) |
| Vercel routing, headers, function config | `vercel.json` (created) |
| `startServer()` extracted from `createApp()` | `server/index.ts` (modified) |
| Removed `express-session`, `lusca` dependencies | `package.json`, `script/build.ts` |
| Added `vercel-build` script | `package.json` |
| Updated `.env.example`, `.gitignore` | `.env.example`, `.gitignore` |
| CSRF test updated for stateless double-submit pattern | `server/index.test.ts` |

### Remaining for Phase 1
- Set environment variables in Vercel Dashboard (requires Vercel project creation)
- Create `.env.development`, `.env.staging`, `.env.production` template files
- Deploy and verify

## Architecture Context
GridStart is a **custom Express 5 + React 19 SPA** (not Next.js). Vercel expects serverless functions — short-lived stateless handlers — not long-running HTTP servers. The current app design has several mismatches that this plan addresses.

## Problem Summary

| Concern | Current State | Impact |
|---|---|---|
| Server model | `httpServer.listen()` on port | Needs serverless export instead |
| Session store | `express-session` MemoryStore | Per-instance only; breaks CSRF across invocations |
| In-memory caches | `icsCache`, `jolpicaCache` (Map) | Cold on every serverless invocation |
| Rate limiter | `express-rate-limit` memory store | Per-instance only |
| Static files | Express serves `dist/public/` | Better served via Vercel CDN |
| dotenv | `import "dotenv/config"` loads `.env` | Silent no-op if missing, but needs gating |

## Multi-Environment Configuration

### Environment files
Create template files for each environment (all gitignored):

| File | Purpose |
|---|---|
| `.env.development` | Local dev defaults |
| `.env.staging` | Staging environment overrides |
| `.env.production` | Production environment overrides |
| `.env.example` | Updated with all vars documented |

### Env vars per environment
| Variable | Dev | Staging | Production |
|---|---|---|---|
| `PORT` | 5000 | 5000 | 5000 |
| `NODE_ENV` | development | production | production |
| `CORS_ORIGIN` | http://localhost:5173 | https://staging.example.com | https://gridstart.app |
| `CSRF_SECRET` | dev-secret | staging-secret | <random-prod-secret> |
| `RATE_LIMIT_WINDOW_MS` | 900000 | 900000 | 900000 |
| `RATE_LIMIT_MAX` | 1000 | 5000 | 100 |

On Vercel, env vars are set per-environment in the Vercel Dashboard. The `VERCEL_ENV` variable is auto-injected (`production`, `preview`, `development`).

### dotenv loading
In `server/index.ts`, gate dotenv to silently skip if `.env` is absent (Vercel doesn't use `.env` files — vars come from the Dashboard):

```ts
import "dotenv/config"; // already silently no-ops if .env missing
// Vercel injects process.env directly — no changes needed for prod
// For env-specific .env files, load them after:
const env = process.env.NODE_ENV || "development";
// dotenv.config({ path: `.env.${env}`, override: true });
```

The `import "dotenv/config"` already handles missing `.env` gracefully. On Vercel, `.env` doesn't exist in the deployment, so dotenv is a no-op and Vercel's injected env vars take precedence.

## Step 1: Stateless CSRF (remove session dependency)

**Why**: `express-session` with default MemoryStore cannot work across serverless instances. The session is only used for Lusca CSRF token storage.

**What**: Replace Lusca's session-based CSRF with a double-submit cookie pattern:

- **Create** `server/csrf.ts` — custom middleware:
  - On GET/HEAD/OPTIONS: generate an HMAC-signed CSRF token, set it as a readable `csrf-token` cookie and in the `X-CSRF-Token` response header
  - On mutating methods: validate that the `x-csrf-token` request header matches the `csrf-token` cookie value
  - No session store required — purely cookie-based and stateless

- **Modify** `server/index.ts`:
  - Remove `express-session` import and configuration
  - Remove Lusca CSRF config (keep other Lusca protections or replace with custom middleware)
  - Add custom CSRF middleware in its place
  - Keep `cookie-parser` (needed for reading the CSRF cookie)

### Double-submit cookie pattern
```
GET /api/series
  → Server generates token = HMAC-SHA256(CSRF_SECRET, randomNonce)
  → Set-Cookie: csrf-token=randomNonce|token; HttpOnly=false; SameSite=Strict
  → Response header: X-CSRF-Token: randomNonce|token

POST/PUT/DELETE /api/preferences
  ← Client reads csrf-token cookie, sends value in x-csrf-token header
  → Server compares: cookie token === header token
  → Server validates HMAC recomputation
```

## Step 2: Vercel Configuration

### Create `vercel.json`
```json
{
  "name": "gridstart",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "functions": {
    "api/index.ts": {
      "maxDuration": 10,
      "memory": 256
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index.ts" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### Create `server/vercel.ts` — serverless entry point
```ts
import { createApp } from "./index";
import { registerRoutes } from "../server/routes";
import { errorHandler } from "../server/errorHandler";

const { app } = createApp();
await registerRoutes(app);
app.use(errorHandler);

export default app;
```

Key differences from the server entry:
- Does NOT call `httpServer.listen()`
- Does NOT set up Vite dev middleware
- Does NOT call `serveStatic(app)` — static files are served by Vercel CDN
- Exports the Express app as default for `@vercel/node` runtime

## Step 3: Server Adaptations

### Modify `server/index.ts`
- Extract server startup into a separate exported `startServer()` function
- `createApp()` stays the same — usable by both HTTP server and serverless
- Main module check (`isMainModule`) calls `startServer()` (current behavior preserved)
- Serverless entry imports `createApp()` directly, never calls `startServer()`

```ts
export function createApp() {
  const app = express();
  // ... all middleware, CSRF, routes setup ...
  return { app, httpServer };
}

export function startServer() {
  const { app, httpServer } = createApp();
  await registerRoutes(httpServer, app);
  app.use(errorHandler);
  serveStatic(app);
  httpServer.listen(...);
}

// Only start when run directly (not imported by serverless adapter)
if (isMainModule) {
  startServer();
}
```

### Rate limiter in serverless
For Vercel Hobby/Pro (max 10s duration), consider:
- Lower default limits to avoid abuse
- Accept per-instance rate limiting (Vercel Firewall for enterprise-grade)
- The in-memory rate limiter already resets per-cold-start, which is acceptable for Vercel

## Step 4: Static File Serving

In production (non-Vercel):
- `serveStatic(app)` serves `dist/public/` via Express (unchanged)

On Vercel:
- Static files are served from Vercel CDN via the `vercel.json` config
- The `outputDirectory` is `dist`; Vercel automatically serves `dist/public/`
- The serverless function only handles `/api/*` routes
- All other routes (`/`, `/app`, `/assets/*`, `/favicon.svg`, etc.) are served as static assets or fall through to the SPA via Vercel rewrites

## Step 5: Build Adaptation

The existing `npm run build` (`tsx script/build.ts`) outputs:
- `dist/index.cjs` — bundled Express server (not needed on Vercel)
- `dist/public/` — built client assets (needed on Vercel)

For Vercel:
- The `api/index.ts` serverless function uses `@vercel/node` runtime, which handles TypeScript directly
- No need to bundle the server separately
- The client build (Vite) still runs and outputs to `dist/public/`
- Vercel detects and serves static assets from `dist/public/`

Optionally add a `vercel-build` script to `package.json`:
```json
"vercel-build": "npm run build"
```

## Files to Create

| File | Purpose |
|---|---|---|
| `vercel.json` | Vercel deployment configuration |
| `server/vercel.ts` | Serverless adapter entry point |
| `server/csrf.ts` | Stateless double-submit CSRF middleware |
| `.env.development` | Dev environment defaults |
| `.env.staging` | Staging environment defaults |
| `.env.production` | Production environment defaults |
| `.github/workflows/dast.yml` | DAST workflow (Phase 2) |

## Files to Modify

| File | Change |
|---|---|
| `server/index.ts` | Gate dotenv, extract `startServer()`, replace Lusca CSRF with stateless CSRF |
| `server/middleware/rateLimit.ts` | Add DAST bypass header check (Phase 2) |
| `package.json` | Add `vercel-build` script |
| `.env.example` | Add Vercel env vars and per-environment documentation |
| `.gitignore` | Add `.env.*` except `.env.example` |

## Multi-Node Deployment (Future Work)

The app is **not ready** for true multi-node horizontal scaling. The following changes would be needed:

### 1. Shared Cache (Redis / Upstash)
- Replace `icsCache` (Map in `icsFetcher.ts`) with Redis-backed cache
- Replace `jolpicaCache` (Map in `jolpica.ts`) with Redis-backed cache
- Use `ioredis` with Vercel's Upstash Redis integration

### 2. Shared Rate Limiter
- Replace `express-rate-limit` in-memory store with `rate-limit-redis`
- This requires a Redis instance (Upstash works well on Vercel)

### 3. Shared Session Store (if sessions are re-added)
- Replace MemoryStore with `connect-redis`
- Only needed if future features use sessions again

### 4. File-Based Config
- `loadFeedsConfig()` in `routes.ts` reads `config/calendar-feeds*.json` at startup
- Works across nodes if config is baked into the container image
- For dynamic config, move to an external store (database, env vars, or API)

### Priority for Multi-Node
1. Redis cache → lower upstream API calls, faster responses
2. Redis rate limiter → consistent rate enforcement
3. Redis sessions → only if user auth is added

## [Phase 2] Staging & DAST

See [`backlog/dast.md`](dast.md) for the full DAST plan — staging branch, ZAP workflow, rate limiter bypass, WAF config.

## Vercel Deployment Checklist

- [ ] Create Vercel project and link to Git repository
- [ ] Set environment variables in Vercel Dashboard for each environment:
  - Production: `CSRF_SECRET`, `CORS_ORIGIN`, `RATE_LIMIT_MAX`, etc.
  - Preview (staging): same vars with staging-appropriate values
  - Development: auto-linked to PR branches
- [ ] Create `.env.development`, `.env.staging`, `.env.production` template files
- [ ] Verify `vercel.json` routes and headers
- [ ] Test `vercel dev` locally
- [ ] Deploy preview deployment and verify API + static assets
- [ ] Configure custom domain (if applicable)
- [ ] Verify CSRF token exchange works across cold starts
- [ ] Run `npm test` before production deploy

## Verification Steps

1. `npm run build` succeeds with Vercel build command
2. `vercel dev` serves both API and SPA correctly locally
3. CSRF token exchange works across multiple requests (stateless)
4. Static assets served from Vercel CDN with correct Cache-Control headers
5. API routes work without session dependency
6. Environment-specific vars resolve correctly for each environment
7. Rate limiting functions (per-instance, acceptable for Hobby/Pro)
8. CORS allows only the configured origin
9. Legacy server mode (`npm start`) still works for non-Vercel deployments
