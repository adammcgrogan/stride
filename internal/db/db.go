package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func New(path string) (*DB, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, err
		}
	}
	sqlDB, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(1) // SQLite is single-writer
	return &DB{sqlDB}, nil
}

func Migrate(database *DB) error {
	for _, statement := range migrations {
		if _, err := database.Exec(statement); err != nil {
			return err
		}
	}
	return nil
}

var migrations = []string{
	`CREATE TABLE IF NOT EXISTS athletes (
		id            INTEGER PRIMARY KEY,
		username      TEXT,
		firstname     TEXT,
		lastname      TEXT,
		city          TEXT,
		country       TEXT,
		profile       TEXT,
		access_token  TEXT,
		refresh_token TEXT,
		expires_at    INTEGER
	)`,
	`CREATE TABLE IF NOT EXISTS activities (
		id                   INTEGER PRIMARY KEY,
		athlete_id           INTEGER NOT NULL REFERENCES athletes(id),
		name                 TEXT,
		type                 TEXT,
		sport_type           TEXT,
		distance             REAL,
		moving_time          INTEGER,
		elapsed_time         INTEGER,
		total_elevation_gain REAL,
		start_date           TEXT,
		start_date_local     TEXT,
		timezone             TEXT,
		average_speed        REAL,
		max_speed            REAL,
		average_heartrate    REAL,
		max_heartrate        REAL,
		average_cadence      REAL,
		average_watts        REAL,
		kilojoules           REAL,
		suffer_score         REAL,
		summary_polyline     TEXT
	)`,
}
