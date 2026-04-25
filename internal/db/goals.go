package db

import (
	"database/sql"
	"time"
)

type Goal struct {
	ID        int64
	AthleteID int64
	Title     string
	Metric    string  // distance, moving_time, elevation, count, kilojoules, suffer_score
	SportType string  // empty = all sports
	Period    string  // week, month, year, all
	Target    float64 // stored in display units: km, h, m, count, kJ, pts
	CreatedAt string
}

func (db *DB) CreateGoal(goal *Goal) error {
	_, err := db.Exec(
		`INSERT INTO goals (athlete_id, title, metric, sport_type, period, target, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		goal.AthleteID, goal.Title, goal.Metric, goal.SportType,
		goal.Period, goal.Target, time.Now().Format("2006-01-02T15:04:05"),
	)
	return err
}

func (db *DB) GetGoals(athleteID int64) ([]Goal, error) {
	rows, err := db.Query(
		`SELECT id, athlete_id, title, metric, sport_type, period, target, created_at
		 FROM goals WHERE athlete_id = ? ORDER BY created_at DESC`,
		athleteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var goals []Goal
	for rows.Next() {
		var g Goal
		if err := rows.Scan(
			&g.ID, &g.AthleteID, &g.Title, &g.Metric,
			&g.SportType, &g.Period, &g.Target, &g.CreatedAt,
		); err != nil {
			return nil, err
		}
		goals = append(goals, g)
	}
	return goals, rows.Err()
}

func (db *DB) DeleteGoal(id, athleteID int64) error {
	result, err := db.Exec(`DELETE FROM goals WHERE id = ? AND athlete_id = ?`, id, athleteID)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
