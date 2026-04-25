package handlers

import (
	"fmt"
	"html/template"
	"net/http"
	"strconv"

	"stride/internal/config"
	"stride/internal/db"
	"stride/internal/sync"
)

type Handler struct {
	cfg    *config.Config
	db     *db.DB
	syncer *sync.Syncer
}

func New(cfg *config.Config, db *db.DB, syncer *sync.Syncer) *Handler {
	return &Handler{cfg: cfg, db: db, syncer: syncer}
}

var templateFuncs = template.FuncMap{
	"divFloat": func(a, b float64) float64 { return a / b },
	"formatDuration": func(totalSeconds int) string {
		if totalSeconds == 0 {
			return "—"
		}
		hours   := totalSeconds / 3600
		minutes := (totalSeconds % 3600) / 60
		if hours > 0 {
			return fmt.Sprintf("%dh %dm", hours, minutes)
		}
		return fmt.Sprintf("%dm", minutes)
	},
	"formatPace": func(metersPerSecond float64) string {
		if metersPerSecond == 0 {
			return "—"
		}
		secondsPerKm := 1000.0 / metersPerSecond
		minutes := int(secondsPerKm) / 60
		seconds := int(secondsPerKm) % 60
		return fmt.Sprintf("%d:%02d /km", minutes, seconds)
	},
	"formatFloat": func(f float64) string {
		if f == 0 {
			return "—"
		}
		return fmt.Sprintf("%.0f", f)
	},
}

func parseTemplates(files ...string) *template.Template {
	return template.Must(template.New("").Funcs(templateFuncs).ParseFiles(files...))
}

func athleteIDFromCookie(r *http.Request) int64 {
	cookie, err := r.Cookie("athlete_id")
	if err != nil {
		return 0
	}
	id, _ := strconv.ParseInt(cookie.Value, 10, 64)
	return id
}
