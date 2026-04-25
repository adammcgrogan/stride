# Stride — Feature Roadmap

Features 1–4 (Manual Sync, Personal Records, Activity Heatmap, Yearly Goals) are shipped.

---

## Feature 5: Fitness & Freshness Chart (CTL / ATL / TSB)

**User problem:** The single most valuable tool Strava locks behind premium. Serious athletes need to know whether they're building fitness, accumulating fatigue, or ready to race — rolling totals don't answer this.

**Technical plan:**
1. Implement the standard Performance Management Chart model in JavaScript from `/api/activities` data (no backend changes required):
   - **CTL (Fitness):** 42-day exponentially weighted moving average of daily training stress.
   - **ATL (Fatigue):** 7-day exponentially weighted moving average.
   - **TSB (Form):** CTL − ATL. Positive = fresh, negative = fatigued.
2. Use `suffer_score` as the daily training stress score (fall back to `moving_time / 60` when absent).
3. Render as a multi-line ApexCharts area chart on a dedicated section of the Stats page. Three series: Fitness (blue), Fatigue (red), Form (green/red depending on sign).
4. Add a horizontal zero-line on the Form series and shade the negative region red to make fatigue immediately readable.

---

## Feature 6: Year-over-Year Comparison

**User problem:** "Am I fitter than I was this time last year?" is one of the most common questions an athlete has. The current stats show totals — there's no way to compare the current period against the same window in a prior year.

**Technical plan:**
1. On the Stats page, add a year selector (current year vs prior years) to the existing chart.
2. Render two overlaid series on the weekly distance chart: this year in orange, prior year in a muted gray. Use ISO week numbers as the shared x-axis so weeks align correctly across years.
3. Extend `GET /api/activities` — it already returns all data, so the grouping and overlay logic is entirely client-side.
4. Add a summary row below the stat cards: "vs same period last year — +12% distance, +3 activities."

---

## Feature 7: Training Pattern Analysis

**User problem:** Athletes often have no idea when they actually train or what their intensity distribution looks like. "Do I run mostly in the mornings? Am I spending enough time in zone 2?"

**Technical plan:**
1. **Day/hour heatmap:** A 7×24 grid (day of week × hour of day) showing activity frequency. Computed client-side from `StartDateLocal`. Rendered as a small SVG grid similar to the existing calendar heatmap.
2. **Heart rate zone breakdown:** Define 5 zones relative to estimated max HR (220 − age, or user-configurable). For each activity, bucket `average_heartrate` into a zone. Render a stacked bar chart of time in each zone over the filtered period.
3. Both views live as new cards on the Stats page, filtered by the existing sport/date toolbar.
4. Zones are configurable: store `max_hr` (and optionally zone boundaries) in a `settings` table keyed by `athlete_id`.

---

## Feature 8: Route Map Heatmap

**User problem:** Where do I actually train? The activity list is a table of numbers — there's no geographic view of your running territory.

**Technical plan:**
1. We already store `summary_polyline` for every activity. Decode all polylines in JavaScript using a lightweight polyline decoder (no external dependency needed — the algorithm is ~15 lines).
2. Add a `GET /map` page that loads MapLibre GL JS (open-source, no API key required with a free tile provider like OpenStreetMap).
3. Render all decoded route lines on the map as a semi-transparent layer. Overlap density creates the heatmap effect naturally.
4. Add a sport-type filter so users can toggle between running routes, cycling routes, etc.
5. The map view should cluster around the athlete's home region automatically using the bounding box of all coordinates.

---

## Feature 9: Streak & Consistency Tracking

**User problem:** "How many days in a row have I trained?" and "How consistent have I been this month?" are motivating questions with no answer in the current UI.

**Technical plan:**
1. Compute entirely client-side from `/api/activities`:
   - Current streak (consecutive days with ≥1 activity up to today).
   - Longest ever streak.
   - Days active this week / month / year.
   - Rest day frequency (average days between activities).
2. Surface as a stat card row on the Dashboard, below the existing summary cards.
3. Optionally: add a "consistency score" — percentage of days in the last 30 that had activity — displayed as a small ring chart.

---

## Feature 10: Race Predictor

**User problem:** "If I can run 10K in 48 minutes, what's my predicted marathon time?" is a question every runner asks. The Records page shows PRs but doesn't project them forward.

**Technical plan:**
1. Apply the Riegel formula: `T2 = T1 × (D2 / D1)^1.06` using the best-effort times already computed for the Records page.
2. Seed the predictor with the user's best available effort (e.g. best 5K or 10K time).
3. Project out to standard race distances: 1 mile, 5K, 10K, 15K, half marathon, marathon.
4. Render as a clean table on the Records page under a "Race Predictions" heading. Show the input effort used as the basis and allow the user to select a different effort from a dropdown.

---

## Feature 11: Shoe & Gear Tracker

**User problem:** Running shoes wear out around 500–800 km. There's no way to track mileage on individual pairs of shoes, so most athletes guess.

**Technical plan:**
1. New `gear` table: `(id, athlete_id, name, type, added_date, retired BOOL, notes)`.
2. New `activity_gear` join table: `(activity_id, gear_id)` — many-to-many (a brick workout might involve two items).
3. `GET /gear` page: list all gear with accumulated distance, a progress bar toward a configurable retirement threshold (e.g. 700 km for shoes), and a "retire" action.
4. On the activity detail page, add a gear selector to tag which shoes/bike were used.
5. Retired gear remains visible but is greyed out, with total career distance shown.

---

## Feature 12: Activity Notes & Journal

**User problem:** Athletes want to annotate their activities — how they felt, what the conditions were like, what they were training for. Strava has a description field but doesn't surface it and has no search.

**Technical plan:**
1. Add a `notes` column (TEXT) to the `activities` table via migration.
2. On the activity detail page, add an editable textarea that auto-saves via `PATCH /activities/{id}/notes` with debouncing (no save button needed).
3. Surface notes as a preview column in the activities table (truncated to ~60 chars).
4. Add full-text search across notes to the existing search bar on the Activities page using SQLite's `LIKE` or `FTS5` extension.

---

## Feature 13: CSV & GPX Export

**User problem:** Your data should be yours. There's no way to get activity data out of Stride for analysis in Excel, Python, or to import elsewhere.

**Technical plan:**
1. **CSV:** `GET /export/activities.csv` — streams all activities as CSV with all available columns. Respect `sport`, `from`, `to` query params. Add an "Export CSV" button to the activities toolbar.
2. **GPX:** `GET /export/activities/{id}.gpx` — generates a GPX file for a single activity from the stored polyline. Requires decoding the polyline and writing valid GPX XML.
3. Set `Content-Disposition: attachment` on both responses. No new database queries needed beyond what exists.

---

## Feature 14: Strava Webhook Integration

**User problem:** Activities take up to 30 minutes to appear because the sync runs on a fixed ticker. Strava's push API can deliver new activities within seconds of them being uploaded.

**Technical plan:**
1. Register a webhook subscription with Strava's `POST /push_subscriptions` API, pointing to `/webhook` on the running server.
2. Add `GET /webhook` for Strava's hub challenge verification (returns `hub.challenge`).
3. Add `POST /webhook` that parses the event; on `object_type=activity, aspect_type=create`, trigger `syncer.SyncAthlete(athleteID)` for the relevant athlete.
4. Store `subscription_id` in a `settings` table; deregister cleanly on shutdown.
5. Requires the server to be publicly reachable — document the ngrok/Tailscale setup for local dev.

---

## Feature 15: Natural Language Query (LLM)

**User problem:** "What was my highest mileage week ever?", "Show me all runs where I went further than 20km but averaged under 5:30/km" — complex questions that require writing SQL or building custom filters.

**Technical plan:**
1. Add a `GET /ask` page with a text input and result area.
2. On submit, send the user's question to the Claude API along with the SQLite schema and a sample of recent activities as context.
3. The model generates a SQL query; the backend executes it against the `activities` table (read-only, parameterised) and returns results as a table.
4. Render the result table and the generated SQL (collapsed, for transparency).
5. Guard against write queries by checking for `INSERT/UPDATE/DELETE/DROP` before execution, and run in a read-only SQLite connection.
