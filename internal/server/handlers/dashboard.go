package handlers

import "net/http"

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
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

	tmpl := parseTemplates("templates/layout.html", "templates/dashboard.html")
	tmpl.ExecuteTemplate(w, "layout", map[string]any{
		"Athlete": athlete,
		"Stats":   stats,
		"Sports":  sports,
		"Recent":  recent,
	})
}
