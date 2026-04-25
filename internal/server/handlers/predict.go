package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"
)

type PredictSeed struct {
	Label        string  `json:"Label"`
	SportType    string  `json:"SportType"`
	DistanceM    float64 `json:"DistanceM"`
	Seconds      int     `json:"Seconds"`
	ActivityID   int64   `json:"ActivityID"`
	ActivityName string  `json:"ActivityName"`
	Date         string  `json:"Date"`
}

func (h *Handler) Predict(w http.ResponseWriter, r *http.Request) {
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

	var seeds []PredictSeed
	for _, sr := range records {
		for _, pr := range sr.DistancePRs {
			if pr.Activity == nil {
				continue
			}
			seeds = append(seeds, PredictSeed{
				Label:        pr.Label,
				SportType:    sr.SportType,
				DistanceM:    pr.Activity.Distance,
				Seconds:      pr.Activity.MovingTime,
				ActivityID:   pr.Activity.ID,
				ActivityName: pr.Activity.Name,
				Date:         pr.Activity.Date,
			})
		}
	}
	if seeds == nil {
		seeds = []PredictSeed{}
	}

	seedsJSON, err := json.Marshal(seeds)
	if err != nil {
		http.Error(w, "json error", http.StatusInternalServerError)
		return
	}

	tmpl := parseTemplates("web/templates/layout.html", "web/templates/predict.html")
	tmpl.ExecuteTemplate(w, "layout", map[string]any{
		"SeedsJSON": template.JS(seedsJSON),
	})
}
