# GridStart Architecture

GridStart is a full-stack motorsport calendar application that aggregates race schedules from multiple upstream sources into a single normalized calendar experience. The repository is organized around a React frontend, an Express backend, shared contracts, and configuration-driven series definitions. User preferences are stored client-side in a browser cookie.

## System overview

At a high level, GridStart separates presentation, API orchestration, feed ingestion, caching, and persistence. The client requests series, events, preferences, and ICS exports from the backend, while the backend coordinates external feed handlers, applies caching and rate limits, and returns normalized data to the UI.

```mermaid
flowchart LR
    U[User Browser] --> C[React Client\nclient/]
    C -->|Preferences cookie| UC[(Browser Cookie)]
    C --> A[Express API\nserver/]
    A --> K[Configurable Cache\nMemory or Redis\n1-hour TTL]
    A --> F1[Jolpica API\nF1]
    A --> MG[PulseLive API\nMotoGP]
    A --> ICS[ICS Feeds\nMost series]
```

## Repository layout

The top-level repository includes `client/`, `server/`, `shared/`, and `script/`, plus configuration files such as `config/calendar-feeds.json`, `.env.example`, and `package.json`. That layout suggests a deliberate split between UI concerns, backend orchestration, shared schemas/types, and operational helpers.

| Path                         | Purpose                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `client/`                    | React frontend, UI state, routing, event display, filtering, and theme behavior.                    |
| `server/`                    | Express API endpoints, feed fetching, caching, normalization, export generation, and rate limiting. |
| `shared/`                    | Shared types, schemas, or contracts used across client and server boundaries.                       |
| `script/`                    | Utility scripts and maintenance helpers outside the main runtime path.                              |
| `config/calendar-feeds.json` | Configuration-driven definition of motorsport series, handlers, colors, and feed parameters.        |

## Runtime components

The frontend is React 19 with TypeScript, Vite, Tailwind CSS, Radix UI, Wouter, TanStack Query, and date-fns. The backend is Express 5 with TypeScript and ICAL.js, which makes the system a compact full-stack TypeScript application with no external infrastructure requirements.

### Client

The client is responsible for rendering the calendar experience, loading available series, fetching events for date ranges, storing preference choices through the backend, and initiating ICS exports. With responsive design, theme switching, and series filtering, the frontend should be understood as both the interaction layer and the primary composition point for normalized event data.

### Server

The server acts as the integration hub. It exposes API endpoints, fetches source data from ICS feeds and special APIs, applies cache lookups and refreshes, enforces endpoint-specific rate limits, and emits normalized responses to the client and ICS consumers.

### Shared layer

The `shared/` directory is a strong indicator that core contracts are reused across the stack. In practice, this includes database schema definitions, TypeScript models, validation contracts, and shared constants that help keep the client and server aligned as features evolve.

### Persistence (Free Edition)

User preferences are stored entirely client-side in a browser cookie (`gridstart_enabled_series`) with a one-year expiry. The server is stateless — no database is needed. The `IStorage` interface and SQLite-backed `DatabaseStorage` implementation are preserved in the `phase2/database` branch for the upcoming Premium Edition.

### Security

CSRF protection uses a stateless double-submit cookie pattern (no server-side session required). On GET requests, the server sets a cryptographically signed `csrf-token` cookie (readable by client JS) and echoes the token in the `X-CSRF-Token` response header. On mutating requests, the client sends the cookie value in the `x-csrf-token` request header; the server validates that both values match and that the HMAC-SHA256 signature is valid. This design works across serverless instances with no shared state.

## Data sources and handlers

GridStart uses multiple upstream source strategies rather than a single provider. Most series are configured as ICS-based feeds, while Formula 1 and MotoGP use dedicated upstream APIs for richer session-level timing data.

```mermaid
flowchart TD
    R[Requested series] --> S{Series type}
    S -->|Most series| I[ICS handler]
    S -->|F1| J[Jolpica handler]
    S -->|MotoGP| M[PulseLive handler]
    I --> N[Normalize to internal event model]
    J --> N
    M --> N
    N --> C[Cache result]
    C --> O[Return API response or ICS export]
```

### Configuration-driven expansion

Many series can be added through `config/calendar-feeds.json` instead of custom application code. The following configuration fields are available: `id`, `name`, `shortName`, `color`, `handler`, `params`, `enabled`, and optional `sessionNames`, which means new calendar sources can often be onboarded by extending configuration plus handler support rather than redesigning the system.

## Request and data flow

The main operational path starts with client requests to the backend. The backend then resolves the requested series, checks cache state, fetches fresh data when needed, normalizes source-specific fields into a common shape, and returns data to the client or transforms it into an ICS download.

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Client
    participant A as API Server
    participant X as Cache
    participant U as Upstream Source

    B->>C: Open app / change filters
    C->>A: GET /api/series or /api/events
    A->>X: Check cached payload
    alt Fresh cache hit
        X-->>A: Cached normalized data
    else Cache miss or stale
        A->>U: Fetch ICS/API data
        U-->>A: Raw source payload
        A->>A: Normalize events/sessions
        A->>X: Store refreshed payload
    end
    A-->>C: JSON response
    C-->>B: Render calendar

    B->>C: Save enabled series
    C->>C: Write cookie (gridstart_enabled_series)
    C->>C: Refetch events with new preferences
```

## API surface

The API includes `GET /api/series`, `GET /api/events`, and `GET /api/export.ics`. Backend is oriented around discovery, event retrieval, and export generation rather than broad CRUD operations. Preferences are managed entirely client-side via browser cookies. The `/api/preferences` endpoints were removed in 0.7.0.

| Endpoint              | Responsibility                                                  |
| --------------------- | --------------------------------------------------------------- |
| `GET /api/series`     | Returns available series metadata for filtering and display.    |
| `GET /api/events`     | Returns normalized events for selected series and a date range. |
| `GET /api/export.ics` | Produces an exportable ICS calendar for selected series.        |

## Caching and resilience

There is a 1-hour cache TTL for all external data sources, with keys based on series ID or year depending on the feed type. When data is fresh, cached values are returned immediately; when data is stale, the backend refreshes it, and if a refresh fails, stale data can still be used as a fallback.

Caching uses a `CacheProvider` interface with two implementations:

- **MemoryCache** — in-memory `Map`, default when no Redis is configured. Same behavior as the original implementation. No external dependencies.
- **RedisCache** — backed by Upstash Redis (HTTP REST API). Enabled via `REDIS_URL` + `REDIS_TOKEN` env vars. Persists across restarts and works in serverless environments.

The cache backend is selected at startup and is a singleton across the application. Handlers interact only with the `CacheProvider` interface and are unaware of which backend is in use.

This design reduces latency and upstream dependency pressure without introducing extra infrastructure. The Redis option adds persistence without introducing a TCP connection requirement (Upstash uses HTTPS). There is no manual invalidation path yet.

## Future: Premium Edition (Phase 2)

The Premium Edition will reintroduce server-side persistence using the `IStorage` interface preserved in the `phase2/database` branch. Key additions:

- **SQLite database** via Drizzle ORM for user accounts and per-user preferences
- **Authentication** using Passport.js (login / registration)
- **Preference API endpoints** (`GET /api/preferences`, `PUT /api/preferences`) backed by `DatabaseStorage` instead of client cookies

```mermaid
flowchart TD
    Q[Incoming request] --> H{Cache entry exists?}
    H -->|No| F[Fetch upstream data]
    H -->|Yes| T{Entry younger than 1 hour?}
    T -->|Yes| R[Return cached data]
    T -->|No| F
    F --> G{Fetch succeeded?}
    G -->|Yes| W[Write refreshed cache]
    W --> Z[Write to active backend\nMemory or Redis]
    Z --> D[Return fresh data]
    G -->|No| S{Stale cache available?}
    S -->|Yes| Y[Return stale cached data]
    S -->|No| E[Return error]
```
