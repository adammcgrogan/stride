package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
)

func (h *Handler) APIGetSettings(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	maxHR, err := h.db.GetMaxHR(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"max_hr": maxHR})
}

func (h *Handler) APIPatchSettings(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		MaxHR int `json:"max_hr"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.MaxHR < 100 || body.MaxHR > 250 {
		http.Error(w, "invalid max_hr", http.StatusBadRequest)
		return
	}
	if err := h.db.SetMaxHR(athleteID, body.MaxHR); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) APIPolylines(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	polylines, err := h.db.GetPolylines(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(polylines)
}

func (h *Handler) APIActivities(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	activities, err := h.db.GetActivities(athleteID, limit, offset)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

// APISplits returns the splits for a single activity, fetching from Strava and
// caching in the DB on first access.
func (h *Handler) APISplits(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	activityID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}

	needsFetch := func() bool {
		fetched, err := h.db.SplitsFetched(activityID)
		if err != nil || !fetched {
			return true
		}
		// If the cache exists but has no valid splits, reset and re-fetch.
		existing, err := h.db.GetSplits(activityID)
		if err != nil || len(existing) == 0 {
			_ = h.db.ResetSplitsFetched(activityID)
			return true
		}
		return false
	}

	if needsFetch() {
		client, err := h.syncer.GetClientForAthlete(athleteID)
		if err != nil {
			http.Error(w, "auth error", http.StatusInternalServerError)
			return
		}
		detail, err := client.GetActivity(activityID)
		if err != nil {
			log.Printf("splits: fetch activity %d: %v", activityID, err)
			http.Error(w, "strava error", http.StatusBadGateway)
			return
		}
		log.Printf("splits: activity %d — metric splits: %d, standard splits: %d",
			activityID, len(detail.SplitsMetric), len(detail.SplitsStandard))
		for i, s := range detail.SplitsMetric {
			log.Printf("  metric[%d]: index=%d dist=%.0fm speed=%.2fm/s", i, s.SplitIndex, s.Distance, s.AverageSpeed)
		}
		if err := h.db.StoreSplits(activityID, detail.SplitsMetric, detail.SplitsStandard); err != nil {
			log.Printf("splits: store %d: %v", activityID, err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	}

	splits, err := h.db.GetSplits(activityID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	log.Printf("splits: returning %d splits for activity %d", len(splits), activityID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(splits)
}

// APIProgress returns a lightweight list of all activities (date, sport, distance, time)
// used by the best-efforts progression chart on the Records page.
func (h *Handler) APIProgress(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	activities, err := h.db.GetActivitiesForProgress(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}
