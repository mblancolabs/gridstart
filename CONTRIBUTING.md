# Contributing to GridStart

Thanks for your interest in contributing to GridStart.

GridStart is a full-stack motorsport calendar application that aggregates racing schedules from multiple series into a unified view. Contributions are welcome across the frontend, backend, feed integrations, documentation, bug fixes, and developer experience.

## Before You Start

Please read these files first:

- `README.md` for project setup and runtime behavior
- `.env.example` for supported environment variables
- `config/calendar-feeds.json` for series configuration
- `shared/` folder for shared types, schemas, and contracts

## What You Can Contribute

Useful contributions include:

- Bug fixes
- UI improvements
- Performance improvements
- Accessibility improvements
- Better error handling and observability
- Additional motorsport series
- Improvements to feed parsing or caching
- Documentation updates
- Tests and validation scripts

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- Redis (optional) — only required to test the Redis cache path locally. A free instance can be obtained from [Upstash](https://upstash.com/). Set `REDIS_URL` and `REDIS_TOKEN` in your `.env` file to enable it. The app runs fully without Redis using the in-memory cache.

### Install

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

By default, the app runs on `http://localhost:5000` with the in-memory cache. No Redis required.
To enable the Redis cache, set `REDIS_URL` and `REDIS_TOKEN` in your `.env` file.

## Project Layout

```text
client/     Frontend application (React + TypeScript)
server/     Hono API, feed fetching, caching, export endpoints
shared/     Shared types, schema, and cross-layer code
script/     Utility or maintenance scripts
```

Additional important files:

- `config/calendar-feeds.json`: configuration for calendar feeds and supported series
- `.env.example`: local environment variable reference
- `README.md`: primary project documentation

## Branches and Pull Requests

Please use a short-lived feature branch for your work.

Examples:

- `feat/add-imsa-support`
- `fix/export-timezone-bug`
- `docs/improve-setup-guide`

When opening a pull request:

1. Explain the problem being solved.
2. Summarize the approach you took.
3. List any trade-offs or limitations.
4. Include screenshots for UI changes.
5. Mention any config, schema, or feed changes.
6. Link related issues if they exist.

Small, focused pull requests are easier to review and merge than large mixed changes.

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR titles. PR titles are validated automatically by a GitHub Action on open/edit.

The format is:

```
type(scope): description
```

Allowed types:

| Type | Release | Description |
|------|---------|-------------|
| `feat` | minor | A new feature |
| `fix` | patch | A bug fix |
| `docs` | — | Documentation changes |
| `style` | — | Code style (formatting, missing semicolons, etc.) |
| `refactor` | — | Code refactoring |
| `perf` | patch | Performance improvements |
| `test` | — | Adding or fixing tests |
| `build` | — | Build system or dependencies |
| `ci` | — | CI/CD configuration |
| `chore` | — | Maintenance, tooling, minor changes |
| `revert` | — | Reverting a previous change |

Use `!` after the type/scope for breaking changes (e.g. `feat!:`, `feat(api)!:`). Breaking changes would normally bump the major version, but while GridStart is pre-v1 (`bump-minor-pre-major: true`), they bump the minor version instead (e.g. 0.9.10 → 0.10.0).

When the project is ready for v1.0.0, push an empty commit with `Release-As: 1.0.0` in the body:

```bash
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
```

Scopes are optional but encouraged for larger changes (e.g. `feat(cache):`, `fix(export):`).

### Target branch

All pull requests should target `main` unless you have been explicitly asked to target `staging`.

- `main` — production branch; all normal contributions go here
- `staging` — used for pre-release validation; only used when explicitly coordinating a staged rollout

### Syncing staging with main

After a `staging → main` merge, `staging` falls behind `main` and needs to be
reset to the new `main`. To trigger the sync:

1. Go to **Actions** → **Sync staging with main** → **Run workflow**
2. Leave `remote` as `origin` and click **Run workflow**

The workflow temporarily disables the staging branch protection, force-pushes
`main → staging`, and re-enables protection.

#### Pre-requisites

These must be set in **Settings → Secrets and variables → Actions**:

| Type | Name | Value |
|------|------|-------|
| Secret | `SYNC_PAT` | PAT with `repo` scope (see below) |
| Variable | `STAGING_RULESET_ID` | `17083082` |

#### Creating the PAT

1. Go to https://github.com/settings/tokens → **Fine-grained tokens** → **Generate new token**
2. Repository access: **Only select repositories** → `mblancolabs/gridstart`
3. Permissions: **Contents: Write** (for force push), **Metadata: Read** (auto-granted)
4. Generate and copy the token

```bash
gh secret set SYNC_PAT -R mblancolabs/gridstart
gh variable set STAGING_RULESET_ID -R mblancolabs/gridstart --body 17083082
```

#### Offline fallback

If GitHub Actions is unavailable, run `script/sync-staging.sh` locally — it
requires the `gh` CLI and the same variables in `.env`.

## Coding Guidelines

### General

- Prefer small, readable functions.
- Keep names explicit rather than clever.
- Avoid unrelated refactors in feature PRs.
- Update docs when behavior changes.
- Preserve current behavior unless the PR explicitly changes it.

### Frontend

- Keep components focused and composable.
- Reuse shared UI patterns where possible.
- Maintain responsive behavior for desktop and mobile.
- Preserve theme compatibility for dark and light modes.

### Backend

- Keep endpoint behavior predictable and explicit.
- Validate incoming input.
- Handle upstream feed failures gracefully.
- Prefer stale cache fallback over breaking responses where appropriate.
- Do not introduce breaking API changes without documenting them clearly.

### Data and Feeds

- Treat upstream feeds as unreliable inputs.
- Expect missing fields, time changes, and malformed data.
- Prefer normalization close to ingestion.
- Keep mapping logic testable and easy to inspect.

## Adding or Updating a Series

Most series are configured through `config/calendar-feeds.json`.

When adding a new series:

1. Add a unique `id`.
2. Add the display `name` and `shortName`.
3. Set a stable `color`.
4. Set the correct `handler`.
5. Add required `params`, such as feed URL or class identifier.
6. Set the default `enabled` state.
7. Add `sessionNames` if the series supports a stable session taxonomy.

Please verify:

- The feed is publicly accessible.
- Event names are consistent enough to parse.
- Session dates and times are correct.
- The series appears correctly in filtering and export flows.

For F1 and MotoGP, check any special handling already documented in the README before changing source logic.

## Schema Changes

If your change affects shared schemas or types:

1. Update the definitions in `shared/`.
2. Verify the app still starts from a clean setup.
3. Document any schema implications in the PR.

Avoid schema changes that are unnecessary for the feature.

## Testing Conventions

GridStart uses a mixed test layout:

- Put tests that cover a single module next to that module.
- Put tests that cover multiple modules or a user journey in the root `tests/` directory.

Examples:

```text
client/src/components/CalendarView.tsx
client/src/components/CalendarView.test.tsx

server/services/feed-normalizer.ts
server/services/feed-normalizer.test.ts

shared/calendar.ts
shared/calendar.test.ts

tests/e2e/calendar-navigation.spec.ts
tests/integration/events-api.test.ts
```

### Client tests

For frontend code, prefer colocated test files over feature-level `__tests__` folders.

Preferred:

```text
client/src/components/EventCard.tsx
client/src/components/EventCard.test.tsx
```

Avoid:

```text
client/src/components/__tests__/EventCard.test.tsx
```

Use `*.test.ts` or `*.test.tsx` consistently for new client tests.

Keep shared client test helpers in a stable location such as:

```text
client/src/__tests__/setup.ts
client/src/test-utils/
```

The `client/src/__tests__/` directory is reserved for shared test setup and utilities, not for ordinary component or hook tests.

### Root tests directory

Use the root `tests/` directory only for tests that do not belong to one source module:

- `tests/e2e/` for Playwright end-to-end tests
- `tests/integration/` for cross-layer tests such as API + persistence or feed + cache flows
- `tests/fixtures/` for shared fixtures when they are used across layers

## Testing Checklist

Before opening a pull request, please verify:

- The app installs cleanly.
- The app starts locally.
- The target feature works as expected.
- Existing flows still work:
  - series listing
  - event loading
  - preferences persistence
  - ICS export
- Dark mode and light mode still work.
- Mobile layout is still usable.
- Documentation is updated if needed.

If you add parsing logic or feed integrations, include a clear reproduction case in the PR description.

Before pushing, also run the code quality checks locally to avoid avoidable CI failures:

```bash
npm run lint   # ESLint + TypeScript check across client, server, and shared
npm run test   # Unit and integration tests
```

Both must pass before opening a pull request.

## Changelog

`CHANGELOG.md` is auto-generated from conventional commit history by [Release Please](https://github.com/googleapis/release-please) and updated as part of each release. Contributors do **not** need to edit it directly.

If your PR fixes a notable bug or adds a meaningful feature, make sure the PR title follows conventional commit format — the relevant entry will appear in the changelog at release time.

## CI/CD

The project uses several GitHub Actions workflows:

- **PR Title Lint** (`pr-title-lint.yaml`) — validates PR titles follow conventional commit format on every pull request. Skips PRs labelled `dependencies` (like dependabot).
- **CI** (`ci.yaml`) — runs linting, typechecking, tests, and build on every pull request and push to `main`. This is the main validation gate. Does not deploy.
- **Release Please** (`release-please.yaml`) — on every push to `main`, scans for conventional commits since the last release. Opens or updates a Release PR that includes the version bump and changelog. When the Release PR is merged, creates a GitHub release and deploys to Cloudflare Pages.
- **Deploy Production** (`deploy.yaml`) — manual `workflow_dispatch` fallback for emergency re-deployments. Not part of normal flow.

### Release process

1. Merge feature PRs into `main` with conventional commit titles.
2. Release Please automatically creates/updates a Release PR with the proposed version bump and changelog.
3. Verify the Release PR content, then merge it.
4. Release Please tags the release, creates a GitHub Release, and deploys to Cloudflare Pages.
5. The release is live on production.

### Release Please setup

Release Please requires a GitHub Personal Access Token (PAT) with sufficient permissions to create release PRs, push version bumps, and create GitHub releases. The default `GITHUB_TOKEN` cannot be used because GitHub Actions does not trigger new workflow runs for events created by the built-in token — without a PAT, CI checks would not run on the Release PR.

These must be set in **Settings → Secrets and variables → Actions**:

| Type | Name | Value |
|------|------|-------|
| Secret | `RELEASE_PLEASE_PAT` | Fine-grained PAT with `Contents: Write` and `Pull requests: Write` |

**Creating the PAT:**

1. Go to https://github.com/settings/tokens → **Fine-grained tokens** → **Generate new token**
2. Repository access: **Only select repositories** → `mblancolabs/gridstart`
3. Permissions: **Contents: Write** (push version bumps and tags), **Pull requests: Write** (create and update Release PRs), **Metadata: Read** (auto-granted)
4. Generate and copy the token

```bash
gh secret set RELEASE_PLEASE_PAT -R mblancolabs/gridstart
```

## Reporting Bugs

A good bug report includes:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and OS, if relevant
- Date/time and series involved, if feed-related
- Screenshots or logs, if helpful

Please be as specific as possible for calendar, timezone, and feed issues.

## Suggesting Features

Feature requests are welcome. Please include:

- The problem you want to solve
- Why it matters to users
- A rough proposal
- Any alternatives you considered

This helps keep discussion practical and implementation-oriented.

## Documentation Contributions

Documentation improvements are valuable, especially around:

- setup clarity
- architecture
- feed configuration
- environment variables
- deployment
- troubleshooting

If something confused you while onboarding, improving that area is a useful contribution.

## Review Expectations

Maintainers may ask contributors to:

- reduce PR scope
- split changes into multiple PRs
- add documentation
- add validation or tests
- revise naming or structure for consistency

That is normal and intended to keep the project maintainable.

## License

By contributing to this repository, you agree that your contributions will be licensed under the repository’s MIT License.
