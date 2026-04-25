package db

import (
	"database/sql"
	"errors"
	"fmt"
)

type ActivitySummary struct {
	ID           int64
	Name         string
	Date         string
	Distance     float64 // meters
	MovingTime   int     // seconds
	Elevation    float64 // meters
	AverageSpeed float64 // m/s, set only when Distance > 0 && MovingTime > 0
}

type DistancePR struct {
	Label    string
	Activity *ActivitySummary // nil if no qualifying activity found for this band
}

type SportRecords struct {
	SportType      string
	DistancePRs    []DistancePR     // one entry per band; always fully populated
	HasDistancePRs bool             // true if at least one band returned an activity
	Longest        *ActivitySummary // max distance
	BestPace       *ActivitySummary // best pace (min moving_time/distance)
	MostElev       *ActivitySummary // max total_elevation_gain
}

type band struct {
	Label    string
	Min, Max float64 // meters
}

var bandsByCategory = map[string][]band{
	"running": {
		{"5K", 4000, 8000},
		{"10K", 8000, 15000},
		{"Half Marathon", 17000, 25000},
		{"Marathon", 36000, 50000},
	},
	"cycling": {
		{"10K", 8000, 15000},
		{"20K", 15000, 28000},
		{"50K", 38000, 65000},
		{"100K", 80000, 130000},
		{"200K", 160000, 260000},
	},
	"swimming": {
		{"100m", 50, 200},
		{"500m", 300, 800},
		{"1K", 700, 2000},
		{"2K", 1500, 3500},
		{"5K", 3500, 8000},
	},
}

var sportCategory = map[string]string{
	"Run": "running", "TrailRun": "running", "VirtualRun": "running",
	"Walk": "running", "Hike": "running",
	"Ride": "cycling", "VirtualRide": "cycling", "GravelRide": "cycling",
	"MountainBikeRide": "cycling", "EBikeRide": "cycling",
	"Swim": "swimming", "OpenWaterSwim": "swimming",
}

func bandsForSport(sportType string) []band {
	if cat, ok := sportCategory[sportType]; ok {
		return bandsByCategory[cat]
	}
	return bandsByCategory["running"] // sensible default for unknown sports
}

func (db *DB) GetPersonalRecords(athleteID int64) ([]SportRecords, error) {
	rows, err := db.Query(`
		SELECT DISTINCT sport_type FROM activities
		WHERE athlete_id = ? AND sport_type != ''
		ORDER BY sport_type`, athleteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sports []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		sports = append(sports, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var records []SportRecords
	for _, sport := range sports {
		sr := SportRecords{SportType: sport}

		for _, b := range bandsForSport(sport) {
			filter := fmt.Sprintf("distance BETWEEN %.0f AND %.0f AND moving_time > 0", b.Min, b.Max)
			a, err := db.bestActivity(athleteID, sport, "CAST(moving_time AS REAL) / distance ASC", filter)
			if err != nil {
				return nil, err
			}
			sr.DistancePRs = append(sr.DistancePRs, DistancePR{Label: b.Label, Activity: a})
			if a != nil {
				sr.HasDistancePRs = true
			}
		}

		if sr.Longest, err = db.bestActivity(athleteID, sport, "distance DESC", "distance > 0"); err != nil {
			return nil, err
		}
		if sr.BestPace, err = db.bestActivity(athleteID, sport, "CAST(moving_time AS REAL) / distance ASC", "distance > 0 AND moving_time > 0"); err != nil {
			return nil, err
		}
		if sr.MostElev, err = db.bestActivity(athleteID, sport, "total_elevation_gain DESC", "total_elevation_gain > 0"); err != nil {
			return nil, err
		}

		if sr.HasDistancePRs || sr.Longest != nil || sr.BestPace != nil || sr.MostElev != nil {
			records = append(records, sr)
		}
	}
	return records, nil
}

func (db *DB) bestActivity(athleteID int64, sportType, orderExpr, filter string) (*ActivitySummary, error) {
	row := db.QueryRow(`
		SELECT id, name, start_date_local, distance, moving_time, total_elevation_gain
		FROM activities
		WHERE athlete_id = ? AND sport_type = ? AND `+filter+`
		ORDER BY `+orderExpr+`
		LIMIT 1`,
		athleteID, sportType,
	)
	var a ActivitySummary
	if err := row.Scan(&a.ID, &a.Name, &a.Date, &a.Distance, &a.MovingTime, &a.Elevation); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if a.Distance > 0 && a.MovingTime > 0 {
		a.AverageSpeed = a.Distance / float64(a.MovingTime)
	}
	return &a, nil
}
