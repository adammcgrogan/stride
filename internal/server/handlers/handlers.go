package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"html/template"
	"net/http"
	"strconv"
	"strings"

	"stride/internal/config"
	"stride/internal/db"
	"stride/internal/format"
	"stride/internal/sync"
	"stride/web"
)

type Handler struct {
	cfg       *config.Config
	db        *db.DB
	syncer    *sync.Syncer
	templates map[string]*template.Template
}

func New(cfg *config.Config, db *db.DB, syncer *sync.Syncer) *Handler {
	h := &Handler{cfg: cfg, db: db, syncer: syncer}
	h.templates = map[string]*template.Template{
		"dashboard":  parseTemplates("templates/layout.html", "templates/dashboard.html"),
		"activities": parseTemplates("templates/layout.html", "templates/activities.html"),
		"activity":   parseTemplates("templates/layout.html", "templates/activity.html"),
		"stats":      parseTemplates("templates/layout.html", "templates/stats.html"),
		"goals":      parseTemplates("templates/layout.html", "templates/goals.html"),
		"predict":    parseTemplates("templates/layout.html", "templates/predict.html"),
		"records":    parseTemplates("templates/layout.html", "templates/records.html"),
		"fitness":    parseTemplates("templates/layout.html", "templates/fitness.html"),
		"map":        parseTemplates("templates/layout.html", "templates/map.html"),
		"share":      parseTemplates("templates/share_layout.html", "templates/share.html"),
	}
	return h
}

var templateFuncs = template.FuncMap{
	"divFloat":      func(a, b float64) float64 { return a / b },
	"fmtKm":         format.DistanceKm,
	"formatRunTime": format.RunTime,
	"formatDate":    format.Date,
	"formatDuration": format.Duration,
	"formatPace":    format.Pace,
	"formatFloat":   format.Float,
	"sportClass":    format.SportBadgeClass,
	"formatMaxSpeed": format.MaxSpeed,
	"restTime":      format.RestTime,
	"fullName":      format.FullName,
	"weatherDesc":   format.WeatherDesc,
}

func parseTemplates(files ...string) *template.Template {
	return template.Must(template.New("").Funcs(templateFuncs).ParseFS(web.FS, files...))
}

// requirePage checks authentication for page handlers, redirecting to login on failure.
// Returns (athleteID, true) when authenticated.
func (h *Handler) requirePage(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id := h.athleteIDFromCookie(r)
	if id == 0 {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return 0, false
	}
	return id, true
}

// requireAPI checks authentication for API handlers, returning 401 on failure.
// Returns (athleteID, true) when authenticated.
func (h *Handler) requireAPI(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id := h.athleteIDFromCookie(r)
	if id == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return 0, false
	}
	return id, true
}

// pathID parses the "id" path value as an int64.
func pathID(r *http.Request) (int64, error) {
	return strconv.ParseInt(r.PathValue("id"), 10, 64)
}

// athleteIDFromCookie reads and verifies the session cookie.
// In production (SESSION_SECRET set) the cookie value is HMAC-signed and
// any tampered or unsigned cookie is rejected. In dev mode the raw integer
// is accepted for convenience.
func (h *Handler) athleteIDFromCookie(r *http.Request) int64 {
	cookie, err := r.Cookie("athlete_id")
	if err != nil {
		return 0
	}
	if h.cfg.SessionSecret == "" {
		id, _ := strconv.ParseInt(cookie.Value, 10, 64)
		return id
	}
	return verifySessionCookie(cookie.Value, h.cfg.SessionSecret)
}

// setAthleteCookie writes the session cookie. In production it is HMAC-signed
// and marked Secure; in dev it is a plain integer for easy inspection.
func (h *Handler) setAthleteCookie(w http.ResponseWriter, athleteID int64) {
	value := strconv.FormatInt(athleteID, 10)
	if h.cfg.SessionSecret != "" {
		value = signSessionCookie(athleteID, h.cfg.SessionSecret)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "athlete_id",
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.cfg.Production(),
	})
}

// signSessionCookie returns "{id}.{hex(HMAC-SHA256(secret, id))}".
func signSessionCookie(athleteID int64, secret string) string {
	msg := strconv.FormatInt(athleteID, 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(msg))
	return msg + "." + hex.EncodeToString(mac.Sum(nil))
}

// verifySessionCookie parses a signed cookie value and returns the athlete ID,
// or 0 if the signature is missing or invalid.
func verifySessionCookie(value, secret string) int64 {
	dot := strings.LastIndex(value, ".")
	if dot < 0 {
		return 0
	}
	msg := value[:dot]
	sig := value[dot+1:]

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(msg))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return 0
	}
	id, err := strconv.ParseInt(msg, 10, 64)
	if err != nil {
		return 0
	}
	return id
}
