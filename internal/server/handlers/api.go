package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
)

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
