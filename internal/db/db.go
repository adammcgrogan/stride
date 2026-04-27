package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"

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
			if strings.Contains(err.Error(), "duplicate column name") {
				continue
			}
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
	`ALTER TABLE athletes ADD COLUMN last_manual_sync_at INTEGER NOT NULL DEFAULT 0`,
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
	`CREATE TABLE IF NOT EXISTS goals (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		athlete_id INTEGER NOT NULL REFERENCES athletes(id),
		title      TEXT NOT NULL,
		metric     TEXT NOT NULL,
		sport_type TEXT NOT NULL DEFAULT '',
		period     TEXT NOT NULL,
		target     REAL NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`,
	`CREATE TABLE IF NOT EXISTS settings (
		athlete_id INTEGER PRIMARY KEY REFERENCES athletes(id),
		max_hr     INTEGER NOT NULL DEFAULT 190
	)`,
	`ALTER TABLE activities ADD COLUMN start_lat  REAL    NOT NULL DEFAULT 0`,
	`ALTER TABLE activities ADD COLUMN start_lng  REAL    NOT NULL DEFAULT 0`,
	`ALTER TABLE activities ADD COLUMN weather_temp  REAL    NOT NULL DEFAULT 0`,
	`ALTER TABLE activities ADD COLUMN weather_wind  REAL    NOT NULL DEFAULT 0`,
	`ALTER TABLE activities ADD COLUMN weather_precip REAL   NOT NULL DEFAULT 0`,
	`ALTER TABLE activities ADD COLUMN weather_code  INTEGER NOT NULL DEFAULT -1`,
	`ALTER TABLE activities ADD COLUMN splits_fetched INTEGER NOT NULL DEFAULT 0`,
	`CREATE TABLE IF NOT EXISTS activity_splits (
		activity_id   INTEGER NOT NULL,
		split_index   INTEGER NOT NULL,
		unit          TEXT    NOT NULL DEFAULT 'metric',
		distance      REAL    NOT NULL DEFAULT 0,
		elapsed_time  INTEGER NOT NULL DEFAULT 0,
		moving_time   INTEGER NOT NULL DEFAULT 0,
		elev_diff     REAL    NOT NULL DEFAULT 0,
		average_speed REAL    NOT NULL DEFAULT 0,
		average_hr    REAL    NOT NULL DEFAULT 0,
		pace_zone     INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (activity_id, split_index, unit)
	)`,
}
