package handlers

import "testing"

func TestTemplatesParse(t *testing.T) {
	pairs := [][]string{
		{"templates/layout.html", "templates/dashboard.html"},
		{"templates/layout.html", "templates/activities.html"},
		{"templates/layout.html", "templates/activity.html"},
		{"templates/layout.html", "templates/stats.html"},
		{"templates/layout.html", "templates/records.html"},
		{"templates/layout.html", "templates/predict.html"},
		{"templates/layout.html", "templates/fitness.html"},
		{"templates/layout.html", "templates/goals.html"},
		{"templates/layout.html", "templates/map.html"},
		{"templates/share_layout.html", "templates/share.html"},
	}

	for _, files := range pairs {
		t.Run(files[1], func(t *testing.T) {
			parseTemplates(files...)
		})
	}
}
