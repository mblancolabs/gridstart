# Plan: Vercel Deployment & Multi-Environment Configuration

## Overview
This document outlines the changes needed to deploy GridStart on Vercel with dev/staging/production environment configurations, and documents what would be required for true multi-node scaling.

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
| `DAST_BYPASS_KEY` | — | `<random>` | — |

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

### Create `api/index.ts` — serverless entry point
```ts
import { createApp } from "../server/index";
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
| `api/index.ts` | Serverless adapter entry point |
| `server/csrf.ts` | Stateless double-submit CSRF middleware |
| `.env.development` | Dev environment defaults |
| `.env.staging` | Staging environment defaults |
| `.env.production` | Production environment defaults |
| `.github/workflows/dast.yml` | DAST workflow (baseline + weekly full scan) |

## Files to Modify

| File | Change |
|---|---|
| `server/index.ts` | Gate dotenv, extract `startServer()`, replace Lusca CSRF with stateless CSRF |
| `server/middleware/rateLimit.ts` | Add DAST bypass header check |
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

## Staging Environment for DAST

### Branch Strategy
- Permanent `staging` branch
- Vercel Hobby auto-deploys it → `gridstart-git-staging.vercel.app`
- DAST scans run against this stable preview URL
- Same Vercel project, separate Preview environment scope in Dashboard

### Environment Variables (Staging / Preview scope)

| Variable | Staging Value | Purpose |
|---|---|---|
| `CSRF_SECRET` | `<random>` | Isolated from prod |
| `CORS_ORIGIN` | `https://gridstart-git-staging.vercel.app` | Only allow staging origin |
| `RATE_LIMIT_MAX` | `5000` | High enough for DAST, low enough for basic abuse |
| `DAST_BYPASS_KEY` | `<random>` | Shared secret for ZAP to bypass rate limiting |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 15 min (same as prod) |

`DAST_BYPASS_KEY` is **never** set in the Production environment scope.

### Rate Limiter Bypass

Add to `server/middleware/rateLimit.ts`:

```ts
const bypassKey = process.env.DAST_BYPASS_KEY;
// Before rate limiter middleware
app.use((req, res, next) => {
  if (bypassKey && req.headers['x-dast-bypass'] === bypassKey) {
    return next();
  }
  rateLimiter(req, res, next);
});
```

The bypass key is only present in staging; on production the environment variable is absent and the clause short-circuits.

### WAF Configuration

Vercel Hobby allows 1 rate limit rule. Configure in Vercel Dashboard → Firewall for the staging environment:

| Setting | Value |
|---|---|
| Pattern | `IP` burst > 100 requests in 10s |
| Action | **Challenge** (CAPTCHA) — stops real abuse, ZAP traffic stays under burst or uses bypass header |
| Scope | `environment = preview` (staging only) |

## DAST GitHub Actions Workflow

Create `.github/workflows/dast.yml`:

```yaml
name: DAST
on:
  push:
    branches: [staging]
  schedule:
    - cron: "0 6 * * 0"   # weekly full scan every Sunday 06:00 UTC

jobs:
  baseline:
    name: ZAP Baseline
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        id: vercel
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: ${{ steps.vercel.outputs.preview-url }}
          token: ${{ secrets.GITHUB_TOKEN }}
          cmd_options: >
            -config globalexclusionurl.url=${{ steps.vercel.outputs.preview-url }}/health
            -config "replacer.full_list(0).description=dast-bypass"
            -config 'replacer.full_list(0).enabled=true'
            -config 'replacer.full_list(0).matchtype=REQ_HEADER'
            -config 'replacer.full_list(0).matchstr=x-dast-bypass'
            -config 'replacer.full_list(0).regex=false'
            -config 'replacer.full_list(0).replacement=${{ secrets.DAST_BYPASS_KEY }}'

  full-scan:
    name: ZAP Full Scan
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        id: vercel
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.12.0
        with:
          target: ${{ steps.vercel.outputs.preview-url }}
          token: ${{ secrets.GITHUB_TOKEN }}
          cmd_options: >
            -config globalexclusionurl.url=${{ steps.vercel.outputs.preview-url }}/health
            -config "replacer.full_list(0).description=dast-bypass"
            -config 'replacer.full_list(0).enabled=true'
            -config 'replacer.full_list(0).matchtype=REQ_HEADER'
            -config 'replacer.full_list(0).matchstr=x-dast-bypass'
            -config 'replacer.full_list(0).regex=false'
            -config 'replacer.full_list(0).replacement=${{ secrets.DAST_BYPASS_KEY }}'

### ZAP Alert Exclusions

False positives to suppress in the ZAP context file or via `-config`:

| Alert ID | Reason |
|---|---|
| `10021` (X-Content-Type-Options) | Already set in `vercel.json` headers — ZAP may double-count |
| `10096` (Timestamp Disclosure) | ICS dates and calendar timestamps trigger many false positives |
| `100000` (Script Name Hash) | Vite hashed bundles change on every deploy |

These can be set via ZAP CLI or the ZAP API after initial scan review.

## Vercel Deployment Checklist

- [ ] Create Vercel project and link to Git repository
- [ ] Set environment variables in Vercel Dashboard for each environment:
  - Production: `CSRF_SECRET`, `CORS_ORIGIN`, `RATE_LIMIT_MAX`, etc.
  - Preview (staging): same vars + `DAST_BYPASS_KEY` with staging values
  - Development: auto-linked to PR branches
- [ ] Verify `vercel.json` routes and headers
- [ ] Test `vercel dev` locally
- [ ] Deploy preview deployment and verify API + static assets
- [ ] Configure custom domain (if applicable)
- [ ] Enable Vercel Firewall rate limit rule on staging (burst > 100/10s → challenge, scope = preview)
- [ ] Verify CSRF token exchange works across cold starts
- [ ] Run `npm test` before production deploy
- [ ] Create `staging` branch and push — verify auto-deploy to `gridstart-git-staging.vercel.app`
- [ ] Set `DAST_BYPASS_KEY`, `CSRF_SECRET`, `CORS_ORIGIN` in Preview environment scope
- [ ] Register `DAST_BYPASS_KEY` as a GitHub Actions secret
- [ ] Create `.github/workflows/dast.yml`
- [ ] Verify ZAP baseline passes against staging (push a trivial change to `staging`)
- [ ] Verify `x-dast-bypass` header is NOT effective on production (DAST_BYPASS_KEY absent)
- [ ] Review first full-scan report and fine-tune alert exclusions

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
