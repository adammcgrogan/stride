package handlers

import (
	"net/http"

	"stride/internal/strava"
)

func (h *Handler) AuthLogin(w http.ResponseWriter, r *http.Request) {
	redirectURL := strava.AuthURL(h.cfg.StravaClientID, h.cfg.StravaRedirectURL, "stride")
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h *Handler) AuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	token, err := strava.Exchange(h.cfg.StravaClientID, h.cfg.StravaClientSecret, code)
	if err != nil {
		http.Error(w, "token exchange failed", http.StatusInternalServerError)
		return
	}

	if err := h.db.UpsertAthlete(&token.Athlete, token.AccessToken, token.RefreshToken, token.ExpiresAt); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	h.setAthleteCookie(w, token.Athlete.ID)
	http.Redirect(w, r, "/", http.StatusSeeOther)
}
