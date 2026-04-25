package db

import "stride/internal/strava"

type ActivityRow struct {
	ID                 int64
	Name               string
	SportType          string
	Distance           float64
	MovingTime         int
	ElapsedTime        int
	TotalElevationGain float64
	StartDateLocal     string
	Timezone           string
	AverageSpeed       float64
	MaxSpeed           float64
	AverageHeartrate   float64
	MaxHeartrate       float64
	AverageCadence     float64
	AverageWatts       float64
	Kilojoules         float64
	SufferScore        float64
	SummaryPolyline    string
}

func (db *DB) UpsertActivity(athleteID int64, a *strava.Activity) error {
	_, err := db.Exec(`
		INSERT INTO activities (
			id, athlete_id, name, type, sport_type, distance, moving_time, elapsed_time,
			total_elevation_gain, start_date, start_date_local, timezone,
			average_speed, max_speed, average_heartrate, max_heartrate,
			average_cadence, average_watts, kilojoules, suffer_score, summary_polyline
		) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			name              = excluded.name,
			average_heartrate = excluded.average_heartrate,
			suffer_score      = excluded.suffer_score,
			summary_polyline  = excluded.summary_polyline`,
		a.ID, athleteID, a.Name, a.Type, a.SportType, a.Distance, a.MovingTime, a.ElapsedTime,
		a.TotalElevationGain, a.StartDate, a.StartDateLocal, a.Timezone,
		a.AverageSpeed, a.MaxSpeed, a.AverageHeartrate, a.MaxHeartrate,
		a.AverageCadence, a.AverageWatts, a.Kilojoules, a.SufferScore, a.Map.SummaryPolyline,
	)
	return err
}

func (db *DB) GetActivities(athleteID int64, limit, offset int) ([]ActivityRow, error) {
	rows, err := db.Query(`
		SELECT id, name, sport_type, distance, moving_time, total_elevation_gain,
		       start_date_local, average_speed, average_heartrate, suffer_score
		FROM activities WHERE athlete_id = ?
		ORDER BY start_date_local DESC
		LIMIT ? OFFSET ?`,
		athleteID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []ActivityRow
	for rows.Next() {
		var activity ActivityRow
		if err := rows.Scan(
			&activity.ID, &activity.Name, &activity.SportType, &activity.Distance,
			&activity.MovingTime, &activity.TotalElevationGain, &activity.StartDateLocal,
			&activity.AverageSpeed, &activity.AverageHeartrate, &activity.SufferScore,
		); err != nil {
			return nil, err
		}
		activities = append(activities, activity)
	}
	return activities, rows.Err()
}

// GetActivity returns a single activity only if it belongs to athleteID,
// preventing one athlete from reading another's data by guessing an ID.
func (db *DB) GetActivity(athleteID, id int64) (*ActivityRow, error) {
	row := db.QueryRow(`
		SELECT id, name, sport_type, distance, moving_time, elapsed_time, total_elevation_gain,
		       start_date_local, timezone, average_speed, max_speed, average_heartrate,
		       max_heartrate, average_cadence, average_watts, kilojoules, suffer_score, summary_polyline
		FROM activities WHERE id = ? AND athlete_id = ?`, id, athleteID)

	var activity ActivityRow
	err := row.Scan(
		&activity.ID, &activity.Name, &activity.SportType, &activity.Distance,
		&activity.MovingTime, &activity.ElapsedTime, &activity.TotalElevationGain,
		&activity.StartDateLocal, &activity.Timezone, &activity.AverageSpeed, &activity.MaxSpeed,
		&activity.AverageHeartrate, &activity.MaxHeartrate, &activity.AverageCadence,
		&activity.AverageWatts, &activity.Kilojoules, &activity.SufferScore, &activity.SummaryPolyline,
	)
	return &activity, err
}

type Stats struct {
	TotalActivities    int
	TotalDistance      float64
	TotalElevation     float64
	TotalMovingTime    int
	ThisYearDistance   float64
	ThisYearActivities int
}

func (db *DB) GetStats(athleteID int64) (*Stats, error) {
	var stats Stats
	err := db.QueryRow(`
		SELECT
			COUNT(*),
			COALESCE(SUM(distance), 0),
			COALESCE(SUM(total_elevation_gain), 0),
			COALESCE(SUM(moving_time), 0),
			COALESCE(SUM(CASE WHEN strftime('%Y', start_date_local) = strftime('%Y', 'now') THEN distance ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN strftime('%Y', start_date_local) = strftime('%Y', 'now') THEN 1 ELSE 0 END), 0)
		FROM activities WHERE athlete_id = ?`, athleteID,
	).Scan(
		&stats.TotalActivities, &stats.TotalDistance, &stats.TotalElevation, &stats.TotalMovingTime,
		&stats.ThisYearDistance, &stats.ThisYearActivities,
	)
	return &stats, err
}

type PolylineRow struct {
	ID             int64
	Name           string
	SportType      string
	StartDateLocal string
	Distance       float64
	MovingTime     int
	Polyline       string
}

func (db *DB) GetPolylines(athleteID int64) ([]PolylineRow, error) {
	rows, err := db.Query(`
		SELECT id, name, sport_type, start_date_local, distance, moving_time, summary_polyline
		FROM activities
		WHERE athlete_id = ? AND summary_polyline != ''
		ORDER BY start_date_local DESC`, athleteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var polylines []PolylineRow
	for rows.Next() {
		var p PolylineRow
		if err := rows.Scan(&p.ID, &p.Name, &p.SportType, &p.StartDateLocal, &p.Distance, &p.MovingTime, &p.Polyline); err != nil {
			return nil, err
		}
		polylines = append(polylines, p)
	}
	return polylines, rows.Err()
}

type SportStat struct {
	SportType string
	Count     int
	Distance  float64
}

func (db *DB) GetSportBreakdown(athleteID int64) ([]SportStat, error) {
	rows, err := db.Query(`
		SELECT sport_type, COUNT(*), COALESCE(SUM(distance), 0)
		FROM activities WHERE athlete_id = ?
		GROUP BY sport_type ORDER BY COUNT(*) DESC`, athleteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var breakdown []SportStat
	for rows.Next() {
		var stat SportStat
		if err := rows.Scan(&stat.SportType, &stat.Count, &stat.Distance); err != nil {
			return nil, err
		}
		breakdown = append(breakdown, stat)
	}
	return breakdown, rows.Err()
}
