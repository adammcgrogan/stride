package handlers

import "net/http"

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	tmpl := parseTemplates("templates/layout.html", "templates/stats.html")
	tmpl.ExecuteTemplate(w, "layout", nil)
}
