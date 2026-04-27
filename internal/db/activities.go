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
	StartLat           float64
	StartLng           float64
	WeatherTemp        float64
	WeatherWind        float64
	WeatherPrec        float64
	WeatherCode        int
	ShareToken         string
	AthleteFirstname   string
	AthleteLastname    string
}

func (db *DB) UpsertActivity(athleteID int64, a *strava.Activity) error {
	var lat, lng float64
	if len(a.StartLatLng) == 2 {
		lat, lng = a.StartLatLng[0], a.StartLatLng[1]
	}
	_, err := db.Exec(`
		INSERT INTO activities (
			id, athlete_id, name, type, sport_type, distance, moving_time, elapsed_time,
			total_elevation_gain, start_date, start_date_local, timezone,
			average_speed, max_speed, average_heartrate, max_heartrate,
			average_cadence, average_watts, kilojoules, suffer_score, summary_polyline,
			start_lat, start_lng
		) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			name              = excluded.name,
			average_heartrate = excluded.average_heartrate,
			suffer_score      = excluded.suffer_score,
			summary_polyline  = excluded.summary_polyline,
			start_lat         = excluded.start_lat,
			start_lng         = excluded.start_lng`,
		a.ID, athleteID, a.Name, a.Type, a.SportType, a.Distance, a.MovingTime, a.ElapsedTime,
		a.TotalElevationGain, a.StartDate, a.StartDateLocal, a.Timezone,
		a.AverageSpeed, a.MaxSpeed, a.AverageHeartrate, a.MaxHeartrate,
		a.AverageCadence, a.AverageWatts, a.Kilojoules, a.SufferScore, a.Map.SummaryPolyline,
		lat, lng,
	)
	return err
}

func (db *DB) GetActivities(athleteID int64, limit, offset int) ([]ActivityRow, error) {
	rows, err := db.Query(`
		SELECT id, name, sport_type, distance, moving_time, total_elevation_gain,
		       start_date_local, average_speed, average_heartrate, suffer_score,
		       weather_temp, weather_code
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
		var a ActivityRow
		if err := rows.Scan(
			&a.ID, &a.Name, &a.SportType, &a.Distance,
			&a.MovingTime, &a.TotalElevationGain, &a.StartDateLocal,
			&a.AverageSpeed, &a.AverageHeartrate, &a.SufferScore,
			&a.WeatherTemp, &a.WeatherCode,
		); err != nil {
			return nil, err
		}
		activities = append(activities, a)
	}
	return activities, rows.Err()
}

// GetActivity returns a single activity only if it belongs to athleteID,
// preventing one athlete from reading another's data by guessing an ID.
func (db *DB) GetActivity(athleteID, id int64) (*ActivityRow, error) {
	row := db.QueryRow(`
		SELECT id, name, sport_type, distance, moving_time, elapsed_time, total_elevation_gain,
		       start_date_local, timezone, average_speed, max_speed, average_heartrate,
		       max_heartrate, average_cadence, average_watts, kilojoules, suffer_score,
		       summary_polyline, start_lat, start_lng, weather_temp, weather_wind,
		       weather_precip, weather_code, share_token
		FROM activities WHERE id = ? AND athlete_id = ?`, id, athleteID)

	var a ActivityRow
	err := row.Scan(
		&a.ID, &a.Name, &a.SportType, &a.Distance,
		&a.MovingTime, &a.ElapsedTime, &a.TotalElevationGain,
		&a.StartDateLocal, &a.Timezone, &a.AverageSpeed, &a.MaxSpeed,
		&a.AverageHeartrate, &a.MaxHeartrate, &a.AverageCadence,
		&a.AverageWatts, &a.Kilojoules, &a.SufferScore, &a.SummaryPolyline,
		&a.StartLat, &a.StartLng, &a.WeatherTemp, &a.WeatherWind,
		&a.WeatherPrec, &a.WeatherCode, &a.ShareToken,
	)
	return &a, err
}

// SetShareToken stores a share token for an activity owned by athleteID.
func (db *DB) SetShareToken(athleteID, activityID int64, token string) error {
	_, err := db.Exec(
		`UPDATE activities SET share_token=? WHERE id=? AND athlete_id=?`,
		token, activityID, athleteID,
	)
	return err
}

// RevokeShareToken clears the share token, making the activity private again.
func (db *DB) RevokeShareToken(athleteID, activityID int64) error {
	_, err := db.Exec(
		`UPDATE activities SET share_token='' WHERE id=? AND athlete_id=?`,
		activityID, athleteID,
	)
	return err
}

// GetActivityByToken returns an activity by its public share token, with no athlete check.
// Athlete firstname/lastname are joined so the share page can credit the owner.
func (db *DB) GetActivityByToken(token string) (*ActivityRow, error) {
	row := db.QueryRow(`
		SELECT a.id, a.name, a.sport_type, a.distance, a.moving_time, a.elapsed_time,
		       a.total_elevation_gain, a.start_date_local, a.timezone, a.average_speed,
		       a.max_speed, a.average_heartrate, a.max_heartrate, a.average_cadence,
		       a.average_watts, a.kilojoules, a.suffer_score, a.summary_polyline,
		       a.start_lat, a.start_lng, a.weather_temp, a.weather_wind,
		       a.weather_precip, a.weather_code, a.share_token,
		       at.firstname, at.lastname
		FROM activities a
		JOIN athletes at ON at.id = a.athlete_id
		WHERE a.share_token=? AND a.share_token != ''`, token)

	var a ActivityRow
	err := row.Scan(
		&a.ID, &a.Name, &a.SportType, &a.Distance,
		&a.MovingTime, &a.ElapsedTime, &a.TotalElevationGain,
		&a.StartDateLocal, &a.Timezone, &a.AverageSpeed, &a.MaxSpeed,
		&a.AverageHeartrate, &a.MaxHeartrate, &a.AverageCadence,
		&a.AverageWatts, &a.Kilojoules, &a.SufferScore, &a.SummaryPolyline,
		&a.StartLat, &a.StartLng, &a.WeatherTemp, &a.WeatherWind,
		&a.WeatherPrec, &a.WeatherCode, &a.ShareToken,
		&a.AthleteFirstname, &a.AthleteLastname,
	)
	return &a, err
}

// WeatherPending holds the minimal fields needed to fetch weather for an activity.
type WeatherPending struct {
	ID             int64
	StartLat       float64
	StartLng       float64
	StartDateLocal string
}

// GetActivitiesNeedingWeather returns up to limit activities that have coordinates
// but haven't had weather fetched yet (weather_code = -1).
func (db *DB) GetActivitiesNeedingWeather(athleteID int64, limit int) ([]WeatherPending, error) {
	rows, err := db.Query(`
		SELECT id, start_lat, start_lng, start_date_local
		FROM activities
		WHERE athlete_id = ? AND weather_code = -1 AND start_lat != 0
		ORDER BY start_date_local DESC
		LIMIT ?`,
		athleteID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pending []WeatherPending
	for rows.Next() {
		var p WeatherPending
		if err := rows.Scan(&p.ID, &p.StartLat, &p.StartLng, &p.StartDateLocal); err != nil {
			return nil, err
		}
		pending = append(pending, p)
	}
	return pending, rows.Err()
}

// MarkNoLocationActivities sets weather_code = -2 for activities that have no
// GPS coordinates, so they are permanently skipped during weather fetching.
func (db *DB) MarkNoLocationActivities(athleteID int64) error {
	_, err := db.Exec(`
		UPDATE activities SET weather_code = -2
		WHERE athlete_id = ? AND weather_code = -1 AND start_lat = 0`,
		athleteID,
	)
	return err
}

// SetActivityWeather stores fetched weather conditions for a single activity.
func (db *DB) SetActivityWeather(id int64, temp, wind, precip float64, code int) error {
	_, err := db.Exec(
		`UPDATE activities SET weather_temp=?, weather_wind=?, weather_precip=?, weather_code=? WHERE id=?`,
		temp, wind, precip, code, id,
	)
	return err
}

// ProgressActivity holds the minimal fields needed for the best-efforts chart.
type ProgressActivity struct {
	Date     string
	Sport    string
	Distance float64
	Time     int
}

// GetActivitiesForProgress returns all activities with distance and time,
// ordered chronologically. Used by the best-efforts progression chart.
func (db *DB) GetActivitiesForProgress(athleteID int64) ([]ProgressActivity, error) {
	rows, err := db.Query(`
		SELECT start_date_local, sport_type, distance, moving_time
		FROM activities
		WHERE athlete_id = ? AND distance > 0 AND moving_time > 0
		ORDER BY start_date_local ASC`,
		athleteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []ProgressActivity
	for rows.Next() {
		var a ProgressActivity
		if err := rows.Scan(&a.Date, &a.Sport, &a.Distance, &a.Time); err != nil {
			return nil, err
		}
		activities = append(activities, a)
	}
	return activities, rows.Err()
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
