package handlers

import "net/http"

func (h *Handler) Records(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	records, err := h.db.GetPersonalRecords(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	tmpl := parseTemplates("web/templates/layout.html", "web/templates/records.html")
	tmpl.ExecuteTemplate(w, "layout", map[string]any{
		"Records": records,
	})
}
