package sync

import (
	"log"

	"stride/internal/config"
	"stride/internal/db"
	"stride/internal/strava"
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
	return nil
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
