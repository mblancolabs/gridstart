# Cloudflare Setup

Reference guide for Cloudflare Pages deployment, environment configuration, and DAST scanning.

## Project

- **Pages project:** `gridstart`
- **Production branch:** `main` — auto-deploys to `gridstart.pages.dev`
- **Staging branch:** `staging` — auto-deploys to `staging.gridstart.pages.dev`
- **Build command:** `npm run build:worker`
- **Build output:** `dist`

Staging is protected by Cloudflare Access. Only authenticated users (and the DAST service token) can reach it.

## Environment Variables

### `wrangler.toml` (committed, plaintext)

Non-sensitive config that differs between environments:

| Variable | Preview/Staging | Production |
|---|---|---|
| `RATE_LIMIT_MAX` | `5000` | `2000` |

These are set in `[vars]` (staging) and `[env.production]` (production) sections of `wrangler.toml`.

### Cloudflare Pages dashboard secrets (encrypted, per-scope)

Sensitive values set in **Pages → gridstart → Settings → Environment variables**:

| Scope | Variable | Purpose |
|---|---|---|
| Preview | `CORS_ORIGIN` | `https://staging.gridstart.pages.dev` |
| Preview | `CSRF_SECRET` | Unique random hex (separate from production) |
| Preview | `DAST_BYPASS_KEY` | Bypass secret for DAST scanner (rate limiting) |
| Production | `CORS_ORIGIN` | `https://gridstart.pages.dev` |
| Production | `CSRF_SECRET` | Unique random hex (separate from staging) |

**Policy:** Non-sensitive configurable values go in `wrangler.toml`. Secrets go in the dashboard. `DAST_BYPASS_KEY` is never set in Production scope — the rate limiter ignores the bypass header when the env var is absent.

### Generating secrets

For `CSRF_SECRET` and `DAST_BYPASS_KEY`, generate a 64-character hex string:

```bash
openssl rand -hex 32
```

Each environment (Preview/Production) must use a **different** `CSRF_SECRET`.

## Cloudflare Access

Staging URL is protected via Zero Trust Access:

1. **Application:** Self-hosted, domain `staging.gridstart.pages.dev`
2. **Human policy:** Email-based access for developers
3. **Service token:** `dast-scanner` — used by the DAST GitHub Actions workflow
4. **Service auth policy:** Action: Service Auth, token: `dast-scanner`

The DAST workflow sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers on every request, validated by Access at the edge.

## DAST Scanning

See `backlog/dast.md` for the full plan.

- **Workflow:** `.github/workflows/dast.yml`
- **Trigger:** Manual (`workflow_dispatch`) / Sunday 06:00 UTC (full scan)
- **Bypass:** ZAP replacer injects `x-dast-bypass` header with `DAST_BYPASS_KEY` to skip rate limiting
- **GitHub secrets required:**

| Secret | Source |
|---|---|
| `DAST_BYPASS_KEY` | Same value as Preview secret |
| `CF_ACCESS_CLIENT_ID` | From `dast-scanner` service token |
| `CF_ACCESS_CLIENT_SECRET` | From `dast-scanner` service token |
| `STAGING_URL` | GitHub variable, set to `https://staging.gridstart.pages.dev` |

## WAF Rate Limiting

A WAF rate limiting rule provides burst protection for the staging hostname:

- **Expression:** `(cf.zone.name eq "pages.dev" and http.host eq "staging.gridstart.pages.dev")`
- **Period:** 10 seconds
- **Threshold:** 100 requests
- **Action:** Managed Challenge (JS challenge)

DAST traffic stays under the burst threshold or uses the `x-dast-bypass` header.

## Deployment Pipeline

| Branch | Method | Trigger |
|---|---|---|
| `staging` | Cloudflare Pages auto-build | Push to `staging` |
| `main` | Cloudflare Pages auto-build | PR merge / push to `main` |
