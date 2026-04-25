package db

func (db *DB) GetMaxHR(athleteID int64) (int, error) {
	var maxHR int
	err := db.QueryRow(`SELECT max_hr FROM settings WHERE athlete_id = ?`, athleteID).Scan(&maxHR)
	if err != nil {
		return 190, nil
	}
	return maxHR, nil
}

func (db *DB) SetMaxHR(athleteID int64, maxHR int) error {
	_, err := db.Exec(`
		INSERT INTO settings (athlete_id, max_hr) VALUES (?, ?)
		ON CONFLICT(athlete_id) DO UPDATE SET max_hr = excluded.max_hr`,
		athleteID, maxHR,
	)
	return err
}
