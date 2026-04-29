package handlers

import (
	"net/http"

	"stride/internal/db"
)

type recordsData struct {
	Records []db.SportRecords
}

func (h *Handler) Records(w http.ResponseWriter, r *http.Request) {
	athleteID, ok := h.requirePage(w, r)
	if !ok {
		return
	}

	records, err := h.db.GetPersonalRecords(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	h.templates["records"].ExecuteTemplate(w, "layout", recordsData{Records: records})
}
