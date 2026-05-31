# Changelog

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
