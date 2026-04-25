# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the server
go run ./cmd/stride

# Build a binary
go build -o stride ./cmd/stride

# Vet and check for issues
go vet ./...

# Run all tests
go test ./...

# Run tests for a specific package
go test ./internal/sync/...
```

The server reads `.env` on startup (via godotenv). Copy `.env.example` to `.env` and fill in Strava credentials before running.

## Architecture

The app is a single-binary Go server that pulls Strava activities into a local SQLite database and serves them through a web UI.

**Request flow:**
1. User logs in via Strava OAuth (`/auth/login` → Strava → `/auth/callback`)
2. Callback stores tokens in `athletes` table and fires an initial full sync in a goroutine
3. A background goroutine (`syncer.Start()`) re-syncs all athletes every 30 minutes
4. All pages fetch activity data from `/api/activities` (JSON) and render client-side

**Package responsibilities:**

| Package | Role |
|---------|------|
| `internal/config` | Loads env vars into a `Config` struct |
| `internal/db` | SQLite wrapper; all queries live here (`athlete.go`, `activities.go`) |
| `internal/strava` | Strava API client: OAuth exchange/refresh, paginated activity fetch |
| `internal/sync` | `Syncer` upserts activities; `scheduler.go` runs `syncAllAthletes()` on a ticker |
| `internal/server` | Mounts routes and logging middleware |
| `internal/server/handlers` | One file per page: `auth`, `dashboard`, `activities`, `stats`, `api` |
| `web/templates` | Go `html/template` files; `layout.html` wraps every page via `{{define "layout"}}` |
| `web/static/js` | `utils.js` loaded globally (shared helpers); page-specific JS loaded per template |

**Authentication:** A single `athlete_id` cookie (HttpOnly, SameSite=Lax) identifies the user. `athleteIDFromCookie(r)` is the auth check — returning 0 means unauthenticated. All DB queries filter by `athlete_id`.

**Template functions** are defined in `handlers/handlers.go` (`templateFuncs`): `divFloat`, `formatDuration`, `formatPace`, `formatFloat`.

**JS shared utilities** (`utils.js`): `localDateStr`, `isoWeekStart`, `fmtKm`, `fmtTime`, `periodRange`, `movingAvg`. All page scripts depend on this file being loaded first via `layout.html`.

**Database migrations** are plain SQL strings in `db/db.go` run idempotently with `CREATE TABLE IF NOT EXISTS` on every startup. Add new migrations by appending to the `migrations` slice.

## Project-Wide Refactor Rules
- Priority: Readability > Performance.
- Verbose naming over clever shorthand.
- Small, single-purpose functions.