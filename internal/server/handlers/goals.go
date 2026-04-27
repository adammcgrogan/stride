package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"html/template"
	"net/http"
	"strconv"

	"stride/internal/db"
)

func (h *Handler) Goals(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	goals, err := h.db.GetGoals(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if goals == nil {
		goals = []db.Goal{}
	}

	sports, err := h.db.GetSportBreakdown(athleteID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	goalsJSON, err := json.Marshal(goals)
	if err != nil {
		http.Error(w, "json error", http.StatusInternalServerError)
		return
	}

	tmpl := parseTemplates("templates/layout.html", "templates/goals.html")
	tmpl.ExecuteTemplate(w, "layout", map[string]any{
		"GoalsJSON": template.JS(goalsJSON),
		"Sports":    sports,
	})
}

func (h *Handler) CreateGoal(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	target, err := strconv.ParseFloat(r.FormValue("target"), 64)
	if err != nil || target <= 0 {
		http.Error(w, "invalid target", http.StatusBadRequest)
		return
	}

	goal := &db.Goal{
		AthleteID: athleteID,
		Title:     r.FormValue("title"),
		Metric:    r.FormValue("metric"),
		SportType: r.FormValue("sport_type"),
		Period:    r.FormValue("period"),
		Target:    target,
	}

	validMetrics := map[string]bool{
		"distance": true, "moving_time": true, "elevation": true,
		"count": true, "kilojoules": true, "suffer_score": true,
	}
	validPeriods := map[string]bool{"week": true, "month": true, "year": true, "all": true}

	if goal.Title == "" || !validMetrics[goal.Metric] || !validPeriods[goal.Period] {
		http.Error(w, "invalid fields", http.StatusBadRequest)
		return
	}

	if err := h.db.CreateGoal(goal); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/goals", http.StatusSeeOther)
}

func (h *Handler) DeleteGoal(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteGoal(id, athleteID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
