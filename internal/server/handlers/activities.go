package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"stride/internal/db"
)

type activityDetailData struct {
	*db.ActivityRow
	SimilarRuns []db.SimilarActivity
}

func (h *Handler) Activities(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePage(w, r); !ok {
		return
	}
	h.templates["activities"].ExecuteTemplate(w, "layout", nil)
}

func (h *Handler) ActivityDetail(w http.ResponseWriter, r *http.Request) {
	athleteID, ok := h.requirePage(w, r)
	if !ok {
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/activities/")
	activityID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	activity, err := h.db.GetActivity(athleteID, activityID)
	if err != nil {
		http.Error(w, "activity not found", http.StatusNotFound)
		return
	}

	similar, err := h.db.GetSimilarActivities(
		athleteID, activityID,
		activity.SportType,
		activity.StartLat, activity.StartLng,
		activity.Distance,
	)
	if err != nil {
		similar = nil
	}

	h.templates["activity"].ExecuteTemplate(w, "layout", activityDetailData{
		ActivityRow: activity,
		SimilarRuns: similar,
	})
}
