package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"
)

// labelCanonicalM maps PR band labels to their exact canonical distance in metres.
// Used for the isSeed ratio check so that a 10K activity measured as 10,499 m by
// GPS does not bleed into the 15K row.
var labelCanonicalM = map[string]float64{
	"5K":            5000,
	"10K":           10000,
	"Half Marathon": 21097,
	"Marathon":      42195,
	"100m":          100,
	"500m":          500,
	"1K":            1000,
	"2K":            2000,
	"10K cycling":   10000,
	"20K":           20000,
	"50K":           50000,
	"100K":          100000,
	"200K":          200000,
}

type PredictSeed struct {
	Label        string  `json:"Label"`
	SportType    string  `json:"SportType"`
	DistanceM    float64 `json:"DistanceM"`   // actual GPS distance — used for Riegel
	CanonicalM   float64 `json:"CanonicalM"`  // exact label distance — used for isSeed check
	Seconds      int     `json:"Seconds"`
	ActivityID   int64   `json:"ActivityID"`
	ActivityName string  `json:"ActivityName"`
	Date         string  `json:"Date"`
}

func (h *Handler) Predict(w http.ResponseWriter, r *http.Request) {
	athleteID := h.athleteIDFromCookie(r)
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
			canonM := labelCanonicalM[pr.Label]
			if canonM == 0 {
				canonM = pr.Activity.Distance
			}
			seeds = append(seeds, PredictSeed{
				Label:        pr.Label,
				SportType:    sr.SportType,
				DistanceM:    pr.Activity.Distance,
				CanonicalM:   canonM,
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

	tmpl := parseTemplates("templates/layout.html", "templates/predict.html")
	tmpl.ExecuteTemplate(w, "layout", map[string]any{
		"SeedsJSON": template.JS(seedsJSON),
	})
}
