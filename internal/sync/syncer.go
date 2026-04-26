package sync

import (
	"log"
	"time"

	"stride/internal/config"
	"stride/internal/db"
	"stride/internal/strava"
	"stride/internal/weather"
)

type Syncer struct {
	cfg *config.Config
	db  *db.DB
}

func New(cfg *config.Config, db *db.DB) *Syncer {
	return &Syncer{cfg: cfg, db: db}
}

func (s *Syncer) SyncAthlete(athleteID int64) error {
	athlete, err := s.db.GetAthlete(athleteID)
	if err != nil {
		return err
	}

	accessToken, err := s.getValidAccessToken(athlete)
	if err != nil {
		return err
	}

	client := strava.NewClient(accessToken)
	activities, err := client.GetAllActivities()
	if err != nil {
		return err
	}

	for i := range activities {
		if err := s.db.UpsertActivity(athleteID, &activities[i]); err != nil {
			log.Printf("sync: upsert activity %d: %v", activities[i].ID, err)
		}
	}

	log.Printf("sync: upserted %d activities for athlete %d", len(activities), athleteID)

	go s.fetchWeatherForAthlete(athleteID)
	return nil
}

// fetchWeatherForAthlete fills in missing weather data for activities with GPS coordinates.
// It runs in the background after each sync; at most 25 activities are processed per call
// to avoid hammering the free Open-Meteo API.
func (s *Syncer) fetchWeatherForAthlete(athleteID int64) {
	if err := s.db.MarkNoLocationActivities(athleteID); err != nil {
		log.Printf("weather: mark no-location: %v", err)
	}

	pending, err := s.db.GetActivitiesNeedingWeather(athleteID, 25)
	if err != nil {
		log.Printf("weather: get pending: %v", err)
		return
	}
	if len(pending) == 0 {
		return
	}

	log.Printf("weather: fetching for %d activities (athlete %d)", len(pending), athleteID)

	for i, p := range pending {
		if i > 0 {
			time.Sleep(150 * time.Millisecond)
		}
		conditions, err := weather.Fetch(p.StartLat, p.StartLng, p.StartDateLocal)
		if err != nil {
			log.Printf("weather: activity %d: %v", p.ID, err)
			continue
		}
		if err := s.db.SetActivityWeather(p.ID, conditions.TempC, conditions.WindKph, conditions.PrecipMM, conditions.Code); err != nil {
			log.Printf("weather: store activity %d: %v", p.ID, err)
		}
	}
}

// getValidAccessToken returns the athlete's current access token, refreshing it
// first if it has expired or is about to expire.
func (s *Syncer) getValidAccessToken(athlete *db.AthleteRow) (string, error) {
	if !strava.IsExpired(athlete.ExpiresAt) {
		return athlete.AccessToken, nil
	}

	refreshed, err := strava.Refresh(s.cfg.StravaClientID, s.cfg.StravaClientSecret, athlete.RefreshToken)
	if err != nil {
		return "", err
	}

	if err := s.db.UpdateAthleteTokens(athlete.ID, refreshed.AccessToken, refreshed.RefreshToken, refreshed.ExpiresAt); err != nil {
		return "", err
	}

	return refreshed.AccessToken, nil
}
