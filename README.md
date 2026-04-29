<picture>
  <source media="(prefers-color-scheme: dark)" srcset="web/static/img/stride-logo-white-transparent.svg">
  <source media="(prefers-color-scheme: light)" srcset="web/static/img/stride-logo-dark-transparent.svg">
  <img src="web/static/img/stride-logo-dark-transparent.svg" alt="Stride" height="80">
</picture>

A personal Strava activity tracker that pulls your runs into a local dashboard with stats, records, fitness trends, and goal tracking.

## What it does

Stride connects to your Strava account via OAuth and continuously syncs your activities into a local SQLite database. It then serves a web UI with:

- **Dashboard** — recent activities and a quick overview
- **Activities** — full paginated activity list with detail pages
- **Stats** — weekly/monthly breakdowns by distance, pace, and time
- **Records** — personal bests for common race distances
- **Fitness** — long-term training load and fitness trends
- **Goals** — set and track distance goals
- **Map** — visualise your routes on a map
- **Predict** — race time predictor based on your training

Activities can be synced manually from the UI.

## Requirements

- [Go 1.23+](https://go.dev/dl/)
- A free [Strava account](https://www.strava.com)

## Setup

### 1. Create a Strava API application

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) and create a new application
2. Set **Authorization Callback Domain** to `localhost`
3. Note your **Client ID** and **Client Secret**

### 2. Clone and configure

```bash
git clone <repo-url>
cd stride
cp .env.example .env
```

Edit `.env` and fill in your Strava credentials:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URL=http://localhost:8080/auth/callback
ADDR=:8080
DB_PATH=stride.db
```

### 3. Run

```bash
go run ./cmd/stride
```

Open [http://localhost:8080](http://localhost:8080) and sign in with Strava. An initial full sync of your activities will run automatically on first login.

## Building a binary

```bash
go build -o stride ./cmd/stride
./stride
```

## Multiple users

Stride is designed as a single-user personal tool. Each person should run their own instance with their own Strava API credentials. Strava limits new API apps to one connected athlete, so sharing an instance is not straightforward.

To run a separate instance for another person, they follow the same setup steps above using their own Strava API app.

## Project structure

```
cmd/stride/          — entry point
internal/
  config/            — loads .env into a Config struct
  db/                — SQLite wrapper; all queries
  strava/            — Strava API client (OAuth, activity fetch)
  sync/              — upserts activities; background scheduler
  server/            — HTTP server and middleware
  server/handlers/   — one file per page/route
web/
  templates/         — Go html/template files
  static/            — CSS, JS
```

## Development

```bash
# Run with live .env reloading
go run ./cmd/stride

# Vet
go vet ./...

# Tests
go test ./...
```
