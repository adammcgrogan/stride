package sync

import (
	"log"
	"time"
)

// Start periodically syncs all athletes in the database every 30 minutes.
// Call this in a goroutine from main.
func (s *Syncer) Start() {
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.syncAllAthletes()
	}
}

func (s *Syncer) syncAllAthletes() {
	athleteIDs, err := s.db.GetAllAthleteIDs()
	if err != nil {
		log.Printf("scheduler: failed to fetch athlete IDs: %v", err)
		return
	}
	for _, id := range athleteIDs {
		log.Printf("scheduler: syncing athlete %d", id)
		if err := s.SyncAthlete(id); err != nil {
			log.Printf("scheduler: sync error for athlete %d: %v", id, err)
		}
	}
}
