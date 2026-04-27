package db

import "stride/internal/strava"

type SplitRow struct {
	SplitIndex  int
	Unit        string
	Distance    float64
	ElapsedTime int
	MovingTime  int
	ElevDiff    float64
	AvgSpeed    float64
	AvgHR       float64
	PaceZone    int
}

func (db *DB) GetSplits(activityID int64) ([]SplitRow, error) {
	rows, err := db.Query(`
		SELECT split_index, unit, distance, elapsed_time, moving_time,
		       elev_diff, average_speed, average_hr, pace_zone
		FROM activity_splits
		WHERE activity_id = ? AND split_index > 0 AND distance >= 100
		ORDER BY unit, split_index`, activityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var splits []SplitRow
	for rows.Next() {
		var s SplitRow
		if err := rows.Scan(&s.SplitIndex, &s.Unit, &s.Distance, &s.ElapsedTime,
			&s.MovingTime, &s.ElevDiff, &s.AvgSpeed, &s.AvgHR, &s.PaceZone); err != nil {
			return nil, err
		}
		splits = append(splits, s)
	}
	return splits, rows.Err()
}

func (db *DB) StoreSplits(activityID int64, metric, standard []strava.Split) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT OR REPLACE INTO activity_splits
			(activity_id, split_index, unit, distance, elapsed_time, moving_time,
			 elev_diff, average_speed, average_hr, pace_zone)
		VALUES (?,?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, s := range metric {
		if _, err := stmt.Exec(activityID, s.SplitIndex, "metric",
			s.Distance, s.ElapsedTime, s.MovingTime,
			s.ElevationDifference, s.AverageSpeed, s.AverageHeartrate, s.PaceZone); err != nil {
			return err
		}
	}
	for _, s := range standard {
		if _, err := stmt.Exec(activityID, s.SplitIndex, "standard",
			s.Distance, s.ElapsedTime, s.MovingTime,
			s.ElevationDifference, s.AverageSpeed, s.AverageHeartrate, s.PaceZone); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(`UPDATE activities SET splits_fetched = 1 WHERE id = ?`, activityID); err != nil {
		return err
	}
	return tx.Commit()
}

func (db *DB) SplitsFetched(activityID int64) (bool, error) {
	var v int
	err := db.QueryRow(`SELECT splits_fetched FROM activities WHERE id = ?`, activityID).Scan(&v)
	return v == 1, err
}

func (db *DB) ResetSplitsFetched(activityID int64) error {
	_, err := db.Exec(`UPDATE activities SET splits_fetched = 0 WHERE id = ?`, activityID)
	return err
}
