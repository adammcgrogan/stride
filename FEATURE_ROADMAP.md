# Stride — Feature Roadmap

Features 1–5, 7–10 are shipped (Sync, Records, Activity Heatmap, Goals, Fitness/CTL, Training Patterns, Route Map, Streaks, Race Predictor).

---

## Feature 6: Year-over-Year Comparison

**User problem:** "Am I fitter than I was this time last year?" is one of the most common questions an athlete has. The current stats show totals — there's no way to compare the current period against the same window in a prior year.

**Technical plan:**
1. On the Stats page, add a year selector (current year vs prior years) to the existing chart.
2. Render two overlaid series on the weekly distance chart: this year in orange, prior year in a muted gray. Use ISO week numbers as the shared x-axis so weeks align correctly across years.
3. Extend `GET /api/activities` — it already returns all data, so the grouping and overlay logic is entirely client-side.
4. Add a summary row below the stat cards: "vs same period last year — +12% distance, +3 activities."

---

## Feature 11: Shoe & Gear Tracker

**User problem:** Running shoes wear out around 500–800 km. There's no way to track mileage on individual pairs of shoes, so most athletes guess.

**Technical plan:**
1. New `gear` table: `(id, athlete_id, name, type, added_date, retired BOOL, notes)`.
2. New `activity_gear` join table: `(activity_id, gear_id)` — many-to-many.
3. `GET /gear` page: list all gear with accumulated distance, a progress bar toward a configurable retirement threshold (e.g. 700 km for shoes), and a "retire" action.
4. On the activity detail page, add a gear selector to tag which shoes/bike were used.
5. Retired gear remains visible but greyed out with total career distance shown.

---

## Feature 12: Activity Notes & Journal

**User problem:** Athletes want to annotate their activities — how they felt, what the conditions were like, what they were training for. Strava has a description field but doesn't surface it and has no search.

**Technical plan:**
1. Add a `notes` column (TEXT) to the `activities` table via migration.
2. On the activity detail page, add an editable textarea that auto-saves via `PATCH /activities/{id}/notes` with debouncing (no save button needed).
3. Surface notes as a preview column in the activities table (truncated to ~60 chars).
4. Add full-text search across notes to the existing search bar on the Activities page using SQLite's `LIKE` or `FTS5` extension.

---

## Feature 13: CSV Export

**User problem:** Your data should be yours. There's no way to get activity data out of Stride for analysis in Excel or Python.

**Technical plan:**
1. `GET /export/activities.csv` — streams all activities as CSV with all available columns. Respect `sport`, `from`, `to` query params.
2. Add an "Export CSV" button to the activities toolbar.
3. Set `Content-Disposition: attachment` on the response. No new database queries needed beyond what exists.

---

## Feature 14: Strava Webhook Integration

**User problem:** Activities take up to 30 minutes to appear because the sync runs on a fixed ticker. Strava's push API can deliver new activities within seconds of them being uploaded.

**Technical plan:**
1. Register a webhook subscription with Strava's `POST /push_subscriptions` API, pointing to `/webhook` on the running server.
2. Add `GET /webhook` for Strava's hub challenge verification (returns `hub.challenge`).
3. Add `POST /webhook` that parses the event; on `object_type=activity, aspect_type=create`, trigger `syncer.SyncAthlete(athleteID)` for the relevant athlete.
4. Store `subscription_id` in the `settings` table; deregister cleanly on shutdown.
5. Requires the server to be publicly reachable — document the ngrok/Tailscale setup for local dev.

---

## Feature 15: Best Efforts Progression

**User problem:** The Records page shows your all-time best at each distance, but not how that best has changed over time. "Is my 5K getting faster or have I plateaued?"

**Technical plan:**
1. On the Records page, add a chart below the PR table showing best-effort pace at each standard distance over time (rolling best by month).
2. Computed entirely client-side from `/api/activities` using the same effort-detection logic already used for the records table.
3. Let the user pick which distance to chart (5K, 10K, half, etc.) via a tab or dropdown.
4. Overlay a trend line (moving average) to make the direction of improvement clear.

---

## Feature 16: Activity Tagging

**User problem:** Not all runs are the same. A race, a long run, a recovery jog, and a tempo session are fundamentally different but look identical in the activity list. There's no way to filter or analyse by training intent.

**Technical plan:**
1. New `tags` table: `(id, athlete_id, name, color)`. Pre-populate with sensible defaults: Race, Long Run, Workout, Easy, Commute.
2. New `activity_tags` join table: `(activity_id, tag_id)`.
3. On the activity detail page, add a multi-select tag picker (inline, no modal needed).
4. Add tag filter chips to the Activities page toolbar — selecting one filters the list client-side.
5. On the Stats page, show distance breakdown by tag (stacked bar) so athletes can see how much of their volume is easy vs hard.

---

## Feature 17: Training Load Distribution

**User problem:** Are you training too hard, too easy, or with the right balance? Coaches recommend 80% easy / 20% hard (polarised model). There's no way to see your current split.

**Technical plan:**
1. Classify each activity into Easy / Moderate / Hard using average HR relative to max HR (from the existing `settings.max_hr`):
   - Easy: < 75% max HR
   - Moderate: 75–87%
   - Hard: > 87%
   - Falls back to pace zones if HR is unavailable.
2. On the Stats page, add a stacked area chart showing the weekly volume split by intensity over the last 16 weeks.
3. Show an overall ratio callout: "Last 8 weeks: 71% Easy · 18% Moderate · 11% Hard" so the athlete can compare against the polarised target.

---

## Feature 18: Dark Mode

**User problem:** The app is hardcoded to light mode. Athletes often train early in the morning or late at night and want a UI that doesn't hurt their eyes.

**Technical plan:**
1. The CSS already uses CSS custom properties (`--bg`, `--card`, `--text`, etc.) — add a second `:root[data-theme="dark"]` block that overrides them.
2. Add a theme toggle button in the sidebar (sun/moon icon). On click, flip `data-theme` on `<html>` and persist the preference to `localStorage`.
3. Default to the OS preference (`prefers-color-scheme`) on first visit.
4. No backend changes required — purely CSS + a few lines of JS in `layout.html`.

---

## Feature 19: Personal Dashboard Customisation

**User problem:** Different athletes care about different metrics. A cyclist doesn't need the running pace zones; a casual jogger doesn't care about CTL. The dashboard shows everything to everyone.

**Technical plan:**
1. Add a "Customise" button to the dashboard that toggles an edit mode.
2. In edit mode, each card gets a hide/show toggle. Preferences stored in `localStorage` (no backend needed).
3. Allow drag-to-reorder the main dashboard cards (using the HTML5 Drag and Drop API — no library needed).
4. A "Reset to default" option restores the original layout.

---

## Feature 20: Segment Performance Tracking

**User problem:** Strava Segments are great but locked to Strava's infrastructure. For athletes who run the same routes repeatedly, "how did I do on the climb today vs last time?" is a key question.

**Technical plan:**
1. Detect repeated route segments by comparing decoded polylines — if two activities share a sufficiently similar start/end bounding box and distance, they likely cover the same ground.
2. Group matching routes and show a "Route history" panel on the map page: click a route cluster to see all efforts on that route ranked by pace.
3. No manual segment creation needed — the clustering is automatic.
4. On the activity detail page, if the activity matches a known cluster, show "You've run this route 12 times. Your best: 4:32/km on 14 Feb."

---

## Feature 21: Monthly Training Report

**User problem:** At the end of each month, athletes want a summary of what they did — but there's no consolidated view. You have to mental-math across the stats page.

**Technical plan:**
1. Add a `GET /report/{year}/{month}` page (e.g. `/report/2026/03`).
2. Show: total distance, elevation, time, activity count for the month. Compare each metric to the prior month and same month last year (arrows + % delta).
3. Best activity of the month (longest distance or highest suffer score). Longest streak within the month.
4. Link from the dashboard with a "View March report →" shortcut pointing to the most recently completed month.

---

## Feature 22: Pace & Effort Zones Configuration

**User problem:** The HR zones on the Stats page are computed from a single `max_hr` number. Athletes who use pace-based training (common for running) have no pace zone breakdown, and those who do use HR want to configure zone boundaries precisely.

**Technical plan:**
1. Add a `GET /settings` page (simple form) covering: max HR, HR zone boundaries (5 zones, editable bpm cutoffs), default pace zones (5 zones, editable sec/km cutoffs), preferred units (km/miles).
2. Store all settings in the existing `settings` table (add columns via migration).
3. The HR zones chart on Stats and the training load distribution chart (Feature 17) both read from these settings.
4. Units preference is applied globally — all distance/pace displays read the preference and format accordingly.
