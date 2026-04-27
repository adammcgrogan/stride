package handlers

import (
	"fmt"
	"net/http"
	"time"
)

const manualSyncCooldown = 5 * time.Minute

func (h *Handler) SyncNow(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	lastSync, err := h.db.GetLastManualSync(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	if time.Since(time.Unix(lastSync, 0)) < manualSyncCooldown {
		http.Error(w, "rate limited: please wait 5 minutes between manual syncs", http.StatusTooManyRequests)
		return
	}

	if err := h.syncer.SyncAthlete(athleteID); err != nil {
		http.Error(w, "sync failed", http.StatusInternalServerError)
		return
	}

	now := time.Now().Unix()
	if err := h.db.SetLastManualSync(athleteID, now); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("HX-Trigger", "syncDone")
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) SyncStatus(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	lastSync, err := h.db.GetLastManualSync(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprint(w, formatLastSync(lastSync))
}

func formatLastSync(unixTS int64) string {
	if unixTS == 0 {
		return "Never"
	}
	d := time.Since(time.Unix(unixTS, 0))
	switch {
	case d < time.Minute:
		return "Just now"
	case d < time.Hour:
		return fmt.Sprintf("%d min ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d hr ago", int(d.Hours()))
	default:
		return time.Unix(unixTS, 0).Format("Jan 2")
	}
}
