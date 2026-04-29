package handlers

import (
	"net/http"

	"stride/internal/db"
)

type dashboardData struct {
	Athlete *db.AthleteRow
	Stats   *db.Stats
	Sports  []db.SportStat
	Recent  []db.ActivityRow
}

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	athleteID, ok := h.requirePage(w, r)
	if !ok {
		return
	}

	athlete, err := h.db.GetAthlete(athleteID)
	if err != nil {
		http.Error(w, "athlete not found", http.StatusNotFound)
		return
	}

	stats, err := h.db.GetStats(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	sports, err := h.db.GetSportBreakdown(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	recent, err := h.db.GetActivities(athleteID, 5, 0)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	h.templates["dashboard"].ExecuteTemplate(w, "layout", dashboardData{
		Athlete: athlete,
		Stats:   stats,
		Sports:  sports,
		Recent:  recent,
	})
}
