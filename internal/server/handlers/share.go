package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"

	"stride/internal/card"
	"stride/internal/db"
	"stride/internal/format"
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
	athleteID, ok := h.requireAPI(w, r)
	if !ok {
		return
	}

	activityID, err := pathID(r)
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
	athleteID, ok := h.requireAPI(w, r)
	if !ok {
		return
	}

	activityID, err := pathID(r)
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

	h.templates["share"].ExecuteTemplate(w, "share_layout", sharePageData{
		ActivityRow: activity,
		BaseURL:     baseURL,
	})
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

	a := card.Activity{
		AthleteName: format.FullName(activity.AthleteFirstname, activity.AthleteLastname),
		Name:        activity.Name,
		SportType:   activity.SportType,
		Date:        format.Date(activity.StartDateLocal),
		Distance:    format.Distance(activity.Distance),
		MovingTime:  format.Duration(activity.MovingTime),
		Pace:        format.Pace(activity.AverageSpeed),
		Elevation:   fmt.Sprintf("%.0f m", activity.TotalElevationGain),
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	if err := card.Render(w, a); err != nil {
		http.Error(w, "render error", http.StatusInternalServerError)
	}
}
