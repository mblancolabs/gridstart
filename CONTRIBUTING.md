# Contributing to GridStart

Thanks for your interest in contributing to GridStart.

GridStart is a full-stack motorsport calendar application that aggregates racing schedules from multiple series into a unified view. Contributions are welcome across the frontend, backend, feed integrations, documentation, bug fixes, and developer experience.

## Before You Start

Please read these files first:

- `README.md` for project setup and runtime behavior
- `.env.example` for supported environment variables
- `ics-feeds.json` for series configuration
- `drizzle.config.ts` and the `shared/` folder for schema-related changes

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

### Install

```bash
npm install
```

### Initialize the database

```bash
npm run db:push
```

### Start the development server

```bash
npm run dev
```

By default, the app runs on `http://localhost:5000`.

## Project Layout

```text
client/     Frontend application (React + TypeScript)
server/     Express API, feed fetching, caching, export endpoints
shared/     Shared types, schema, and cross-layer code
script/     Utility or maintenance scripts
```

Additional important files:

- `ics-feeds.json`: configuration for calendar feeds and supported series
- `.env.example`: local environment variable reference
- `drizzle.config.ts`: Drizzle configuration
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

Most series are configured through `ics-feeds.json`.

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

## Database Changes

If your change affects persisted data or schema:

1. Update the shared schema definitions.
2. Run the relevant Drizzle workflow.
3. Verify the app still starts from a clean setup.
4. Document any migration or compatibility implications in the PR.

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
