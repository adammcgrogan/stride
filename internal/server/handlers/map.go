package handlers

import "net/http"

func (h *Handler) Map(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}
	tmpl := parseTemplates("templates/layout.html", "templates/map.html")
	tmpl.ExecuteTemplate(w, "layout", nil)
}
