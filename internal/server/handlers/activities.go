package handlers

import (
	"net/http"
	"strconv"
	"strings"
)

func (h *Handler) Activities(w http.ResponseWriter, r *http.Request) {
	if athleteIDFromCookie(r) == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	tmpl := parseTemplates("web/templates/layout.html", "web/templates/activities.html")
	tmpl.ExecuteTemplate(w, "layout", nil)
}

func (h *Handler) ActivityDetail(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/activities/")
	activityID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	// athleteID is required so an athlete cannot read another's activity by ID.
	activity, err := h.db.GetActivity(athleteID, activityID)
	if err != nil {
		http.Error(w, "activity not found", http.StatusNotFound)
		return
	}

	tmpl := parseTemplates("web/templates/layout.html", "web/templates/activity.html")
	tmpl.ExecuteTemplate(w, "layout", activity)
}
