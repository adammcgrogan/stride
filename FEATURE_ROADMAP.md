# Stride — Feature Roadmap

## Feature 1: Manual Sync Button

**User problem:** Activities only sync on login and every 30 minutes in the background. If you just finished a run and want to see it immediately, you're stuck waiting.

**Technical plan:**
1. Add a `POST /sync` route that calls `syncer.SyncAthlete(athleteID)` in the foreground.
2. Add a "Sync now" button in the sidebar or dashboard header.
3. The button can use an HTMX `hx-post="/sync"` + `hx-swap="none"` with a spinner and a "Last synced: X minutes ago" indicator that refreshes via `hx-trigger="load"` on the dashboard.
4. To prevent abuse, rate-limit the endpoint to one manual sync per athlete per 5 minutes (store last-sync timestamp in the `athletes` table).

---

## Feature 2: Personal Records (PRs) Tracker

**User problem:** There's no way to see your all-time best performances — fastest 5K, longest ride, highest elevation day — without manually scanning the activity list.

**Technical plan:**
1. Add a `GET /records` page and handler.
2. Compute records in a single SQL pass: for running, find the activity closest to common race distances (1 km, 5 km, 10 km, half marathon, marathon) using distance as a proxy, and record `MIN(moving_time / distance)` for pace. For cycling/riding, record `MAX(distance)`, `MAX(average_watts)`, `MAX(total_elevation_gain)`.
3. Add a `db.GetPersonalRecords(athleteID int64) (*Records, error)` function using a single multi-aggregate SQL query.
4. Template: a card grid showing each record with the activity name as a link and the date it was set.

---

## Feature 3: Activity Calendar Heatmap

**User problem:** It's hard to see your consistency at a glance. "Did I work out every week this year?" requires scanning the activity list row by row.

**Technical plan:**
1. The `/api/activities` endpoint already returns all data needed — no new backend work required.
2. In `dashboard.js` (or a dedicated `calendar.js`), group activities by `StartDateLocal` date and map to a daily distance or activity-count value.
3. Render a GitHub-style 52-week grid using a `<canvas>` element or an SVG loop. Each cell is coloured on a 5-step scale using the Strava orange palette (lighter = less, darker = more).
4. Clicking a cell navigates to `/activities?date-from=YYYY-MM-DD&date-to=YYYY-MM-DD` to show activities for that day (the activities page already supports this URL-based filter).

---

## Feature 4: Yearly Goal Progress

**User problem:** "I want to run 1,000 km this year" is a common athlete goal with no native tracking in Stride. There's no way to set a goal and see how you're tracking against it.

**Technical plan:**
1. Add a `goals` table: `(athlete_id, year, sport_type, target_distance_km)`.
2. New routes: `POST /goals` (create/update) and a UI section on the dashboard or stats page.
3. For each active goal, query `GetStats` for `ThisYearDistance` filtered by sport and render a progress bar: `(actual / target) * 100%`.
4. The progress bar should also show a "pace" indicator — if you're at 40% of the year but only 30% of your goal distance, show a warning colour. This requires comparing `dayOfYear / 365` against `actualKm / targetKm`.

---

## Feature 5: Training Load Chart (Fitness & Fatigue)

**User problem:** Serious athletes need to know if they're overtraining or under-recovering. The current stats are totals — there's no view of the *trend* in training load over time.

**Technical plan:**
1. Implement the standard ATL/CTL/TSB model:
   - **CTL (Chronic Training Load / "Fitness"):** 42-day exponentially weighted average of daily training stress.
   - **ATL (Acute Training Load / "Fatigue"):** 7-day exponentially weighted average.
   - **TSB (Training Stress Balance / "Form"):** CTL − ATL.
2. Use `suffer_score` as a proxy for daily training stress (or calculated intensity = `moving_time * average_heartrate`).
3. Compute these in JavaScript from the `/api/activities` data (no backend change needed).
4. Render as a multi-line ApexCharts chart on the Stats page with three series: Fitness, Fatigue, Form. Colour-code Form: green when positive (fresh), red when negative (fatigued).

---

## Feature 6: Strava Webhook Integration

**User problem:** The current polling model (30-minute interval) means new activities take up to 30 minutes to appear. Strava's push API can notify the app the moment an activity is created.

**Technical plan:**
1. Register a webhook subscription with Strava's `POST /push_subscriptions` endpoint using the app's callback URL (`/webhook`).
2. Add a `GET /webhook` handler for Strava's subscription verification challenge (returns `hub.challenge`).
3. Add a `POST /webhook` handler that parses the event payload; if `event.object_type == "activity"` and `event.aspect_type == "create"`, trigger `syncer.SyncAthlete(athleteID)` for just that athlete.
4. Strava requires the webhook endpoint to be publicly reachable. Document the ngrok/Tailscale setup in a README section for local development.
5. Store the `subscription_id` returned by Strava in a new `settings` table so the app can deregister cleanly on shutdown.

---

## Feature 7: CSV Export

**User problem:** Athletes frequently want to analyse their data outside of Stride — in Excel, Google Sheets, or Python. There's no way to get data out of the app today.

**Technical plan:**
1. Add a `GET /export/activities.csv` route and handler.
2. The handler queries `GetActivities(athleteID, limit=100000, offset=0)`, writes CSV headers, then streams each row using Go's `encoding/csv` package.
3. Set `Content-Disposition: attachment; filename="activities.csv"` on the response.
4. Respect the same filters already used by the activities page: accept `sport`, `from`, and `to` query params and pass them to a new `GetActivitiesFiltered` db method.
5. Add an "Export CSV" button to the activities page toolbar, pointing to `/export/activities.csv?<current-filter-params>`, populated dynamically by the existing JS filter state.
