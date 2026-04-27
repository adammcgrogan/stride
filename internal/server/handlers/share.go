package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"stride/internal/card"
	"stride/internal/db"
)

func generateToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// ShareEnable issues a share token for an activity the logged-in athlete owns.
// If the activity already has a token, the existing one is returned unchanged.
// POST /activities/{id}/share
func (h *Handler) ShareEnable(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	activityID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	activity, err := h.db.GetActivity(athleteID, activityID)
	if err != nil {
		http.Error(w, "activity not found", http.StatusNotFound)
		return
	}

	token := activity.ShareToken
	if token == "" {
		token, err = generateToken()
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := h.db.SetShareToken(athleteID, activity.ID, token); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

// ShareDisable revokes the share token, making the activity private again.
// DELETE /activities/{id}/share
func (h *Handler) ShareDisable(w http.ResponseWriter, r *http.Request) {
	athleteID := athleteIDFromCookie(r)
	if athleteID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	activityID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	if err := h.db.RevokeShareToken(athleteID, activityID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type sharePageData struct {
	*db.ActivityRow `json:"-"`
	BaseURL         string
}

// ShareView renders the public read-only activity page.
// GET /share/{token}
func (h *Handler) ShareView(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	activity, err := h.db.GetActivityByToken(token)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	scheme := "https"
	if r.TLS == nil && (r.Header.Get("X-Forwarded-Proto") == "" || r.Header.Get("X-Forwarded-Proto") == "http") {
		scheme = "http"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, r.Host)

	data := sharePageData{ActivityRow: activity, BaseURL: baseURL}
	tmpl := parseTemplates("web/templates/share_layout.html", "web/templates/share.html")
	tmpl.ExecuteTemplate(w, "share_layout", data)
}

// ShareCard generates and serves the OG share card PNG.
// GET /share/{token}/card.png
func (h *Handler) ShareCard(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	activity, err := h.db.GetActivityByToken(token)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	athleteName := activity.AthleteFirstname
	if activity.AthleteLastname != "" {
		if athleteName != "" {
			athleteName += " " + activity.AthleteLastname
		} else {
			athleteName = activity.AthleteLastname
		}
	}

	a := card.Activity{
		AthleteName: athleteName,
		Name:        activity.Name,
		SportType:   activity.SportType,
		Date:        formatDateStr(activity.StartDateLocal),
		Distance:    fmtDistance(activity.Distance),
		MovingTime:  fmtDuration(activity.MovingTime),
		Pace:        fmtPace(activity.AverageSpeed),
		Elevation:   fmt.Sprintf("%.0f m", activity.TotalElevationGain),
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	if err := card.Render(w, a); err != nil {
		http.Error(w, "render error", http.StatusInternalServerError)
	}
}

func formatDateStr(s string) string {
	if len(s) < 10 {
		return s
	}
	// reuse the template func logic inline
	months := []string{"", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
		"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
	var y, m, d int
	fmt.Sscanf(s[:10], "%d-%d-%d", &y, &m, &d)
	if m < 1 || m > 12 {
		return s[:10]
	}
	return fmt.Sprintf("%s %d, %d", months[m], d, y)
}

func fmtDistance(meters float64) string {
	km := meters / 1000
	return fmt.Sprintf("%.1f km", km)
}

func fmtDuration(seconds int) string {
	if seconds == 0 {
		return "—"
	}
	h := seconds / 3600
	m := (seconds % 3600) / 60
	if h > 0 {
		return fmt.Sprintf("%dh %dm", h, m)
	}
	return fmt.Sprintf("%dm", m)
}

func fmtPace(mps float64) string {
	if mps == 0 {
		return "—"
	}
	spk := 1000.0 / mps
	min := int(spk) / 60
	sec := int(spk) % 60
	return fmt.Sprintf("%d:%02d /km", min, sec)
}
