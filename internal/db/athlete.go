package db

import "stride/internal/strava"

type AthleteRow struct {
	ID           int64
	Username     string
	Firstname    string
	Lastname     string
	City         string
	Country      string
	Profile      string
	AccessToken  string
	RefreshToken string
	ExpiresAt    int64
}

func (db *DB) UpsertAthlete(a *strava.Athlete, accessToken, refreshToken string, expiresAt int64) error {
	_, err := db.Exec(`
		INSERT INTO athletes (id, username, firstname, lastname, city, country, profile, access_token, refresh_token, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			access_token  = excluded.access_token,
			refresh_token = excluded.refresh_token,
			expires_at    = excluded.expires_at,
			firstname     = excluded.firstname,
			lastname      = excluded.lastname,
			city          = excluded.city,
			country       = excluded.country,
			profile       = excluded.profile`,
		a.ID, a.Username, a.Firstname, a.Lastname, a.City, a.Country, a.Profile,
		accessToken, refreshToken, expiresAt,
	)
	return err
}

// UpdateAthleteTokens persists a refreshed OAuth token set without touching profile fields.
func (db *DB) UpdateAthleteTokens(athleteID int64, accessToken, refreshToken string, expiresAt int64) error {
	_, err := db.Exec(`
		UPDATE athletes SET access_token = ?, refresh_token = ?, expires_at = ?
		WHERE id = ?`,
		accessToken, refreshToken, expiresAt, athleteID,
	)
	return err
}

func (db *DB) GetAthlete(id int64) (*AthleteRow, error) {
	row := db.QueryRow(`
		SELECT id, username, firstname, lastname, city, country, profile, access_token, refresh_token, expires_at
		FROM athletes WHERE id = ?`, id)

	var athlete AthleteRow
	err := row.Scan(
		&athlete.ID, &athlete.Username, &athlete.Firstname, &athlete.Lastname,
		&athlete.City, &athlete.Country, &athlete.Profile,
		&athlete.AccessToken, &athlete.RefreshToken, &athlete.ExpiresAt,
	)
	return &athlete, err
}

// GetAllAthleteIDs returns every athlete ID stored in the database.
// Used by the background scheduler to sync all registered athletes.
func (db *DB) GetAllAthleteIDs() ([]int64, error) {
	rows, err := db.Query(`SELECT id FROM athletes`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
