# Cloudflare Setup

Reference guide for Cloudflare Pages deployment, environment configuration, and DAST scanning.

## Project

- **Pages project:** `gridstart`
- **Production branch:** `main` — auto-deploys to `<project-name>.pages.dev`
- **Staging branch:** `staging` — auto-deploys to `staging.<project-name>.pages.dev`
- **Build command:** `npm run build:worker`
- **Build output:** `dist`

Staging is protected by Cloudflare Access. Only authenticated users (and the DAST service token) can reach it.

## Environment Variables

### Cloudflare Pages dashboard environment variables

**All** environment variables (both plaintext and secret) are set in **Pages → gridstart → Settings → Environment variables**, with separate values per scope:

| Scope | Variable | Value | Purpose |
|---|---|---|---|
| Preview | `CACHE_PROVIDER` | `kv` | Cache backend (optional — defaults to MemoryCache) |
| Preview | `CACHE_TTL` | `3600` | Cache TTL in seconds (optional) |
| Preview | `CORS_ORIGIN` | `https://staging.<project-name>.pages.dev` | CORS allowed origin |
| Preview | `CSRF_SECRET` | *unique random hex* | CSRF token signing |
| Preview | `DAST_BYPASS_KEY` | *unique random hex* | Bypass secret for DAST scanner (rate limiting) |
| Preview | `RATE_LIMIT_MAX` | `5000` | Max requests per rate-limit window |
| Production | `CACHE_PROVIDER` | `kv` | Cache backend (add after staging test) |
| Production | `CACHE_TTL` | `3600` | Cache TTL in seconds (optional) |
| Production | `CORS_ORIGIN` | `https://<project-name>.pages.dev` | CORS allowed origin |
| Production | `CSRF_SECRET` | *unique random hex* | CSRF token signing |
| Production | `RATE_LIMIT_MAX` | `2000` | Max requests per rate-limit window |

**Policy:** All config is managed in the dashboard. Previously, non-sensitive values lived in `wrangler.toml` — that file has been removed (Phase 1b). `DAST_BYPASS_KEY` is only set in Preview scope — the rate limiter ignores the bypass header when the env var is absent.

### KV namespace bindings (dashboard)

KV bindings are configured in **Pages → gridstart → Settings → Functions → KV namespace bindings**, not in a local config file:

| Scope | Variable name | Namespace |
|---|---|---|
| Production | `CACHE_KV` | `gridstart-cache` (production namespace ID) |
| Preview | `CACHE_KV` | `gridstart-cache` (preview namespace ID) |

### Compatibility flags

The `nodejs_compat` compatibility flag is enabled in **Pages → gridstart → Settings → General → Compatibility flags** (previously set in `wrangler.toml`).

### GitHub Actions deploy token

Production deploys use `wrangler pages deploy` via `.github/workflows/deploy.yaml`, authenticated with a `CLOUDFLARE_API_TOKEN` GitHub secret.

**Create the token:**

1. Go to https://dash.cloudflare.com/profile/api-tokens → **Create Token**
2. Use the **"Edit Cloudflare Workers"** template (covers Pages) or start from scratch
3. Set these permissions only:
   - `Cloudflare Pages` → `Edit`
   - ❌ No `Workers`, `DNS`, `Zone`, or `Account` permissions
4. Scope to your specific account (not all accounts)
5. Set an expiration (e.g., 1 year) — avoid "no expiration"
6. Create and copy the token

**Set the GitHub secret:**

```bash
gh secret set CLOUDFLARE_API_TOKEN -R mblancolabs/gridstart
```

Paste the token when prompted.

**Rotation:** Note the expiry date. Recreate and update the secret before it expires.

### Generating secrets

For `CSRF_SECRET` and `DAST_BYPASS_KEY`, generate a 64-character hex string:

```bash
openssl rand -hex 32
```

Each environment (Preview/Production) must use a **different** `CSRF_SECRET`.

## Cloudflare Access

Staging URL is protected via Zero Trust Access:

1. **Application:** Self-hosted, domain `staging.<project-name>.pages.dev`
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
| `STAGING_URL` | GitHub variable, set to `https://staging.<project-name>.pages.dev` |

## WAF Rate Limiting

A WAF rate limiting rule provides burst protection for the staging hostname:

- **Expression:** `(cf.zone.name eq "pages.dev" and http.host eq "staging.<project-name>.pages.dev")`
- **Period:** 10 seconds
- **Threshold:** 100 requests
- **Action:** Managed Challenge (JS challenge)

DAST traffic stays under the burst threshold or uses the `x-dast-bypass` header.

## Logging

Cloudflare Pages provides several ways to view server-side logs from your Worker:

### Dashboard Logs

Cloudflare Dashboard → Workers & Pages → **gridstart** → **Logs**. Shows live request logs (method, path, status, timing) for recent traffic. No setup required.

### `wrangler tail` (CLI)

Streams live logs from a specific deployment to your terminal, including `console.log` / `console.warn` output:

```bash
# List recent deployments
npx wrangler pages deployment list --project-name gridstart

# Tail logs from a deployment
npx wrangler pages deployment tail --project-name gridstart <deployment-id>
```

The app outputs structured JSON logs via `server/logger.ts` (method, path, status, duration, request ID), which appear in both the dashboard and `wrangler tail`.

### Logpush (advanced)

For long-term retention, enable Logpush in Pages project → Settings → Logpush to forward logs to R2, Datadog, or Grafana Loki.

## Deployment Pipeline

| Branch | Method | Trigger |
|---|---|---|
| `staging` | Cloudflare Pages auto-build | Push to `staging` |
| `main` | Release Please (`release-please.yaml`) | Merge Release PR |
| `main` (manual fallback) | GitHub Actions (`deploy.yaml`) | `workflow_dispatch` |
