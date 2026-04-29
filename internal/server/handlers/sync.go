package handlers

import (
	"fmt"
	"net/http"
	"time"

	"stride/internal/format"
)

const manualSyncCooldown = 5 * time.Minute

func (h *Handler) SyncNow(w http.ResponseWriter, r *http.Request) {
	athleteID, ok := h.requireAPI(w, r)
	if !ok {
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
	athleteID, ok := h.requireAPI(w, r)
	if !ok {
		return
	}

	lastSync, err := h.db.GetLastManualSync(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprint(w, format.LastSync(lastSync))
}
