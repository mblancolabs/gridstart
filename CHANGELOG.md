# Changelog

## [0.9.10] - 2026-07-05

### Added

- **Cloudflare KV CacheProvider** — new `KVCache` backend implementing `CacheProvider` via `KVNamespace.get()` / `KVNamespace.put()` with `expirationTtl`. Same `cache:` key prefix and TTL buffering pattern as `RedisCache`. ([#193](https://github.com/mblancolabs/gridstart/issues/193))

### Changed

- **Explicit cache provider selection** — replaced implicit Redis auto-detection with a `CACHE_PROVIDER` env var (`memory` | `redis` | `kv`). The old `KV_REST_API_URL` / `KV_REST_API_TOKEN` fallback vars are removed. Deployments using Redis must now set `CACHE_PROVIDER=redis` alongside `REDIS_URL` + `REDIS_TOKEN`. ([#193](https://github.com/mblancolabs/gridstart/issues/193))
- **Bumped version** to 0.9.10.

## [0.9.9] - 2026-07-05

### Added

- **Self-hosted fonts** — replaced Fontshare CDN with local `woff2` files for Cabinet Grotesk (5 weights) and General Sans (5 weights), referenced via `/fonts.css`. Removed Fontshare URLs from CSP `style-src` and `font-src` directives. ([#185](https://github.com/mblancolabs/gridstart/issues/185))

### Changed

- **CSRF cookie now HttpOnly** — the `csrf-token` cookie is set with `; HttpOnly` to prevent JavaScript access. The client now reads the token from the `X-CSRF-Token` response header (captured on the first GET response) instead of `document.cookie`. ([#186](https://github.com/mblancolabs/gridstart/issues/186))
- **Removed redundant `X-Frame-Options`** — the `DENY` value was already covered by CSP `frame-ancestors 'none'`; removed from `setSecurityHeaders()`. ([#186](https://github.com/mblancolabs/gridstart/issues/186))
- **CSP scoped to non-API routes** — the `Content-Security-Policy` header is no longer set on `/api/*` responses in the development server. The production worker already scoped CSP to HTML pages only. ([#186](https://github.com/mblancolabs/gridstart/issues/186))
- **Cache-Control aligned** — unified to `no-cache, no-store, must-revalidate` across both `app.ts` and `worker.ts` for consistent caching semantics. ([#186](https://github.com/mblancolabs/gridstart/issues/186))
- **Charset utf-8 on text MIME types** — appended `; charset=utf-8` to `Content-Type` for JavaScript, CSS, HTML, and JSON assets served by the worker. ([#186](https://github.com/mblancolabs/gridstart/issues/186))
- **Bumped version** to 0.9.9.

## [0.9.8] - 2026-07-05

### Changed

- **Removed unused dependencies** — uninstalled `cors`, `@types/cors`, `cookie-parser`, and `@types/cookie-parser` from `package.json` and deleted the redundant `Access-Control-Allow-Origin` header from the server. ([#183](https://github.com/mblancolabs/gridstart/issues/183))
- **Improved browser accessibility** — removed `maximum-scale=1` from the viewport meta to allow pinch-to-zoom; added `-webkit-backdrop-filter` vendor prefix; added `aria-label` attributes to six icon-only buttons; replaced deprecated `apple-mobile-web-app-capable` with `mobile-web-app-capable`; shortened PWA manifest name to fit display limits. ([#184](https://github.com/mblancolabs/gridstart/issues/184))
- **Bumped version** to 0.9.8.

## [0.9.7] - 2026-07-04

### Added

- **CI triggers deploy only after validation** — merged the deploy job into `ci.yaml` with `needs: [validate]` and `if: github.ref == 'refs/heads/main'`, preventing broken commits from reaching production before tests finish. `deploy.yaml` retained as `workflow_dispatch` manual fallback. ([#142](https://github.com/mblancolabs/gridstart/issues/142))
- **Sync staging with main workflow** — new `.github/workflows/sync-staging.yml` as a `workflow_dispatch` action that temporarily disables staging branch protection, force-pushes `main` → `staging`, then re-enables protection. `script/sync-staging.sh` retained as offline fallback. ([#90](https://github.com/mblancolabs/gridstart/issues/90))

### Fixed

- **Secret interpolation in deploy** — replaced heredoc with `node -e writeFileSync` to avoid shell corruption of `calendar-feeds.local.json`. Validates JSON immediately after writing. ([#143](https://github.com/mblancolabs/gridstart/issues/143))

### Changed

- **Bumped version** to 0.9.7.

## [0.9.6] - 2026-07-04

### Added

- **Redis-backed rate limiter** — extracted rate limiting into a `RateLimitStore` provider pattern with `MemoryRateLimitStore` (fallback) and `RedisRateLimitStore` (Upstash REST API via `INCR` + `EXPIRE`). Rate limiting now works across Worker instances. ([#141](https://github.com/mblancolabs/gridstart/issues/141))

### Fixed

- **PWA icons 192×192 and 512×512 now precached** — added missing icon files to `includeAssets` in `vite.config.ts` so the service worker serves them reliably instead of returning 404s from the manifest. ([#118](https://github.com/mblancolabs/gridstart/issues/118))
- **Dev favicon 404** — added `<link rel="icon">` tags (SVG + PNG) to landing page `index.html` so dev server no longer returns 404 for `/favicon.ico`. ([#114](https://github.com/mblancolabs/gridstart/issues/114))
- **Cache-Control prevents stale edge cache** — non-hashed, non-HTML static assets now use `private, max-age=3600` instead of `public`. This prevents Cloudflare's edge from serving stale responses if headers are reclassified in the future, while keeping the browser cache at 1 hour. ([#136](https://github.com/mblancolabs/gridstart/issues/136))
- **feedsConfig validated at build time** — build script now throws a descriptive error if `feedsConfig` is missing or malformed, preventing silent Worker startup failures. ([#148](https://github.com/mblancolabs/gridstart/issues/148))
- **Deterministic event ordering** — refactored `/api/events` and ICS export to use `Promise.all` return values with `.flat()` instead of shared array mutation, guaranteeing events appear in `seriesIds` declaration order. ([#147](https://github.com/mblancolabs/gridstart/issues/147))

### Changed

- **Bumped version** to 0.9.6.

## [0.9.5] - 2026-07-04

### Added

- **Cache-Control headers** — explicit cache directives on all responses. HTML pages: `no-cache, no-store, must-revalidate`. Hashed static assets (JS/CSS in `/assets/` or matching hash pattern): `public, max-age=31536000, immutable`. Other static assets: `public, max-age=3600`. API/health/export responses: `private, no-store`. Resolves ZAP DAST alerts 10015 and 10049. ([#155](https://github.com/mblancolabs/gridstart/issues/155), [#157](https://github.com/mblancolabs/gridstart/issues/157))

### Changed

- **Bumped version** to 0.9.5.

## [0.9.4] - 2026-06-28

### Added

- **`getProductionCsp()`** — new function in `server/security-headers.ts` that returns a strict Content-Security-Policy string with no `'unsafe-inline'`, enabling production CSP enforcement across all responses. ([#102](https://github.com/mblancolabs/gridstart/issues/102))
- **CSS classes for refactored inline styles** — added 22 rules to `client/public/landing.css` including series dot colors, mock flag color, layout utilities, hero em accent, footer cookie notice, and app cookie notice. ([#102](https://github.com/mblancolabs/gridstart/issues/102))
- **`server/security-headers.test.ts`** — dedicated unit tests for `setSecurityHeaders` and `getProductionCsp`.

### Changed

- **No more inline `style` attributes** — removed all 23 inline styles from `client/index.html` and `client/app.html`, replacing them with CSS classes. Page rendering is visually identical. ([#102](https://github.com/mblancolabs/gridstart/issues/102))
- **Production CSP now uses `getProductionCsp()`** — `server/app.ts` delegates to the new shared function instead of an inline array. ([#102](https://github.com/mblancolabs/gridstart/issues/102))
- **CSP applied to static pages** — `server/worker.ts` now sets `Content-Security-Policy` on all three static asset response paths (direct asset fetch, `/` → `index.html` fallback, and `/app` → `app.html` fallback). ([#102](https://github.com/mblancolabs/gridstart/issues/102))
- **Bumped version** to 0.9.4.

## [0.9.3] - 2026-06-28

### Added

- **Permissions-Policy header** — added `Permissions-Policy: geolocation=(), microphone=(), camera=()` to all server responses via `setSecurityHeaders()`. Resolves ZAP DAST alert ID 10063-1. ([#101](https://github.com/mblancolabs/gridstart/issues/101))
- **Subresource Integrity (SRI) hashes** — added `vite-plugin-sri` to inject `sha384` integrity attributes on all Vite-built JS/CSS bundles at build time. Resolves ZAP DAST alert ID 90003. ([#103](https://github.com/mblancolabs/gridstart/issues/103))

### Dependencies

- Added `vite-plugin-sri` (dev dependency).

## [0.9.2] - 2026-06-13

### Fixed

- All-day events in ICS export produced invalid `DTEND` because `ICAL.Time.fromDateString()` expects `YYYY-MM-DD` format but the code passed `YYYYMMDD` (no separators), causing a crash. Also added the missing `DTSTART` for all-day events.

## [0.9.1] - 2026-06-13

### Fixed

- Calendar ICS export endpoint broken on Cloudflare Pages staging due to Cloudflare Access protecting `/api/*` paths. Added a duplicate route at `/export.ics` (outside `/api/`) that bypasses Access, and updated the SyncDialog to use the new URL.

### Changed

- **Wrangler/Pages deployment:** Output Vite build to `dist/` instead of `dist/public/` — fixes root URL serving `index.html` in production.
- **Wrangler/Pages deployment:** Use `NODE_ENV=production` in Preview, inherit from `[vars]` in production.
- **Wrangler/Pages deployment:** Remove `NODE_ENV` from `[vars]` — fixes `npm ci` skipping devDependencies.
- **Wrangler/Pages deployment:** Add `compatibility_date` to `wrangler.toml`.
- **Wrangler/Pages deployment:** Add wrangler preview vars, remove `.env.staging`.

### Dependencies

- Bumped production dependencies (31 updates) including Hono, React, and Radix UI.
- Bumped development dependencies (8 updates) including esbuild to 0.28.1 and wrangler to 4.100.0.

## [0.9.0] - 2026-06-02

### Added

- Cloudflare Workers deployment via `_worker.js` bundle and `wrangler.toml`.
- VPS deployment support via `@hono/node-server` and `server/production.ts`.
- Dual build pipeline: `npm run build:worker` (esbuild → `dist/_worker.js`) and `npm run build:server` (Vite + esbuild → `dist/server/index.js`).
- `server/prod-setup.ts` loads feeds config from filesystem at runtime for VPS production.
- `script/build-server.ts` builds the Node.js server target.

### Changed

- Migrated backend from Express 5 to Hono 4 — same API surface, smaller Worker bundle, edge-native.
- Dev workflow now runs two servers concurrently: Vite (`:5173`) for frontend HMR and Hono (`:5000`) for API, proxied through Vite.
- `npm run build` runs both Worker and Server builds.
- CSRF signing uses Web Crypto API (`crypto.subtle.sign`) instead of Node `crypto.createHmac`.
- Playwright E2E config updated: `baseURL` points to Vite dev server (`:5173`), health check polls `/health`.
- Updated README.md, CONTRIBUTING.md, and docs/ARCHITECTURE.md for Hono, dual deployment, and new dev workflow.

### Removed

- Vercel deployment (`vercel.json`, `server/vercel.ts`, `vercel-build` script).
- `server/vite.ts`, `server/vite.test.ts` — Vite middleware is no longer embedded in the API server.

## [0.8.2] - 2026-05-31

### Chore

- Project structure cleanup: removed stale Drizzle references, fixed documentation paths, moved CHANGELOG to root, added ESLint + Prettier, added `.node-version`, cleaned gitignore.
- Fixed `.vscode/settings.json` CSS custom data config and added ESLint/Prettier editor settings.

## [0.8.1] - 2026-05-31

### Changed

- Replaced Google Fonts (Barlow Condensed, Inter) with Fontshare (Cabinet Grotesk, General Sans) to reduce external dependencies and keep CSP minimal.
- Externalized landing page inline `<style>` to `client/public/landing.css` and inline `<script>` to `client/public/landing.js`.
- Served screenshot locally from `client/public/` instead of remote URL.

### Fixed

- Workbox Fontshare CSP violation: added `https://api.fontshare.com` to `connect-src` in production and development CSP directives.
- `import.meta.url` build warning in CJS output: replaced with a `require.main === module` / `import.meta.url` dual check and silenced the esbuild warning.
- Invalid hook call in `QueryClientProvider` during Vite dev: added `@tanstack/react-query` to `optimizeDeps.include` to ensure correct pre-bundling.

## [0.8.0] - 2026-05-31

### Added

- Configurable cache layer with MemoryCache (default) and RedisCache (optional)
- Redis support via Upstash for persistent caching across restarts and serverless cold starts
- New `server/cache/` module with `CacheProvider` interface for backend-agnostic caching
- New cache unit tests (memory, redis, index)

### Changed

- Feed handlers (ICS, Jolpica, MotoGP) now use shared cache abstraction instead of local Maps
- Cache TTL configurable via `CACHE_TTL` environment variable

### Documentation

- Updated README.md with Redis environment variables and cache backend options
- Updated ARCHITECTURE.md diagrams and caching section for new configurable cache layer
- Updated .env.example with Redis configuration variables
- Updated CONTRIBUTING.md with optional Redis setup note

## [0.7.1] - 2026-05-24

### Changed

- Added cookie disclosure notice to landing page and SPA shell (`client/index.html`, `client/app.html`).

## [0.7.0] - 2026-05-24

### Added

- Free Edition (Phase 1): no database required, fully self-contained.
- User preferences are now stored in a browser cookie (`gridstart_enabled_series`) with one-year expiry.
- New `client/src/lib/preferencesCookie.ts` helper for reading and writing preference cookies.
- Increased client `lib/` test coverage to 100% statements and server coverage to 90%.

### Removed

- SQLite database support: removed `better-sqlite3`, `drizzle-orm`, `drizzle-zod`, and `drizzle-kit` dependencies.
- Server-side `GET /api/preferences` and `PUT /api/preferences` endpoints — preferences are now client-only.
- `server/storage.ts`, `drizzle.config.ts`, and database initialization scripts.
- `SQLITE_FILE_PATH` environment variable.

### Changed

- `usePreferences` and `useSavePreferences` hooks read/write cookies instead of calling the API.
- Server is now fully stateless.
- The database-backed codebase is preserved in the `phase2/database` branch for the upcoming Premium Edition.

## [0.6.1] - 2026-05-24

### Added

- Landing page at `/` with series overview, feature highlights, ICS preview, and "Open Calendar" CTA linking to the app.

### Changed

- The SPA entry point moved from `index.html` to `app.html` and now lives at the `/app` path.
- Fixed Express 5 dev server routing so `app.use` middleware correctly serves the landing page at `/` and the SPA at `/app`.

## [0.6.0] - 2026-05-24

### Added

- PWA support: app is now installable on-device with offline capabilities.
- Web app manifest with standalone display mode, PWA icons, and theme colour.
- Service worker with Workbox: precaches all static assets and caches API responses for offline resilience.
- `PwaInstallButton` that listens for `beforeinstallprompt` and shows an "Install App" button in the header.
- `PwaUpdatePrompt` component that notifies users when a new version is available.
- PWA unit and E2E tests covering manifest, install prompt, service worker registration, offline loading, and icon serving.

### Changed

- Added `worker-src` CSP directive to allow service worker execution.
- Added PWA meta tags (`theme-color`, `apple-mobile-web-app-capable`).
- Reordered `<Toaster />` before `<PwaUpdatePrompt />` so update toasts render correctly.

## [0.5.5] - 2026-05-10

### Changed

- Multiple feeds files support.
- New ECAL feed handler.
- Colour refactor.

## [0.5.2] - 2026-05-02

### Changed

- Bump dependencies versions and clean up.

## [0.5.1] - 2026-05-01

### Changed

- Revent display format to event title. Shorten F1 and MotoGp display titles for calendar application and ICS export.

## [0.5.0] - 2026-04-29

### Changed

- Updated event display format in calendar view and ICS export to show "[shortName] [sessionLabel]" for improved consistency and readability across different calendar applications.

## [0.4.0] - 2026-04-28

### Added

- Added Moto2 and Moto3 calendar feeds, expanding motorcycle series coverage for fans following more than just MotoGP.
- Added a site favicon for a more polished browser and bookmark experience.

### Changed

- Introduced a plugin architecture for feed handling, making the platform easier to extend with new racing series and data sources over time.
- Normalized session names across series, which should make schedules easier to scan and more consistent when comparing sessions between championships.
- Updated the sidebar to show the full series name instead of the short name, improving clarity for users who may not know every racing abbreviation.

### Fixed

- Fixed a MotoGP timezone issue so event times are more accurate for users relying on the calendar for session planning.
- Fixed missing rate limits in static asset and Vite-related paths, improving operational safety and reducing the risk of abusive traffic affecting the app.

### Security

- Added broader rate limiting across services to protect the application and improve service stability under heavy or abusive usage.
- Added CSRF protection and then replaced the initial custom middleware with `lusca`, strengthening request protection using a more established approach.
- Improved secure error handling to reduce information leakage through error responses and logging.
- Addressed and muted specific security-analysis warnings related to Helmet and CSRF configuration after implementation review, reflecting a tightening of the app’s security posture.

## [0.3.0] - 2026-04-26

### Added

- Added automated tests, improving confidence in future changes and making the project easier to maintain as features expand.

### Security

- Added initial CSRF protection support.
- Added rate limiting across services to better protect API availability.
- Improved backend error handling to avoid exposing raw internal errors to clients.

## [0.2.0] - 2026-04-11

### Added

- Added an MIT license file, clarifying reuse and contribution terms for the project.

### Changed

- Renamed the app to **GridStart**, establishing the current product identity.

## [0.1.0] - 2026-04-11

### Added

- Initial public version of the project was committed to the repository.
- Established the first working foundation for the full-stack motorsport calendar application.
