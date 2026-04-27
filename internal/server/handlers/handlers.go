package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"strings"
	"time"

	"stride/internal/config"
	"stride/internal/db"
	"stride/internal/sync"
	"stride/web"
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
	"fmtKm": func(meters float64) string {
		return fmt.Sprintf("%.1f", meters/1000)
	},
	"formatRunTime": func(totalSeconds int) string {
		if totalSeconds == 0 {
			return "—"
		}
		h := totalSeconds / 3600
		m := (totalSeconds % 3600) / 60
		s := totalSeconds % 60
		if h > 0 {
			return fmt.Sprintf("%d:%02d:%02d", h, m, s)
		}
		return fmt.Sprintf("%d:%02d", m, s)
	},
	"formatDate": func(dateStr string) string {
		if len(dateStr) < 10 {
			return dateStr
		}
		t, err := time.Parse("2006-01-02", dateStr[:10])
		if err != nil {
			return dateStr[:10]
		}
		return t.Format("Jan 2, 2006")
	},
	"formatDuration": func(totalSeconds int) string {
		if totalSeconds == 0 {
			return "—"
		}
		hours := totalSeconds / 3600
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
	"sportClass": func(sport string) string {
		switch sport {
		case "Run", "TrailRun", "VirtualRun", "Walk", "Hike":
			return "records-sport-badge--running"
		case "Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "EBikeRide":
			return "records-sport-badge--cycling"
		case "Swim", "OpenWaterSwim":
			return "records-sport-badge--swimming"
		default:
			return "records-sport-badge--default"
		}
	},
	"formatMaxSpeed": func(metersPerSecond float64) string {
		if metersPerSecond == 0 {
			return "—"
		}
		return fmt.Sprintf("%.1f km/h", metersPerSecond*3.6)
	},
	"restTime": func(elapsed, moving int) string {
		rest := elapsed - moving
		if rest <= 0 {
			return ""
		}
		hours := rest / 3600
		minutes := (rest % 3600) / 60
		seconds := rest % 60
		if hours > 0 {
			return fmt.Sprintf("%dh %dm", hours, minutes)
		}
		if minutes > 0 {
			return fmt.Sprintf("%dm %ds", minutes, seconds)
		}
		return fmt.Sprintf("%ds", seconds)
	},
	"fullName": func(first, last string) string {
		if first == "" && last == "" {
			return ""
		}
		if last == "" {
			return first
		}
		if first == "" {
			return last
		}
		return first + " " + last
	},
	"weatherDesc": func(code int) string {
		switch {
		case code == 0:
			return "Clear sky"
		case code <= 3:
			return "Partly cloudy"
		case code <= 48:
			return "Foggy"
		case code <= 57:
			return "Drizzle"
		case code <= 67:
			return "Rain"
		case code <= 77:
			return "Snow"
		case code <= 82:
			return "Showers"
		case code <= 86:
			return "Snow showers"
		default:
			return "Thunderstorm"
		}
	},
}

func parseTemplates(files ...string) *template.Template {
	return template.Must(template.New("").Funcs(templateFuncs).ParseFS(web.FS, files...))
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
