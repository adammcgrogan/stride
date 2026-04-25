package strava

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func AuthURL(clientID, redirectURL, state string) string {
	return fmt.Sprintf(
		"https://www.strava.com/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=activity:read_all&state=%s",
		clientID, url.QueryEscape(redirectURL), state,
	)
}

func Exchange(clientID, clientSecret, code string) (*TokenResponse, error) {
	oauthForm := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
	}
	response, err := http.Post(
		"https://www.strava.com/oauth/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(oauthForm.Encode()),
	)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	var tokenResp TokenResponse
	return &tokenResp, json.NewDecoder(response.Body).Decode(&tokenResp)
}

func Refresh(clientID, clientSecret, refreshToken string) (*TokenResponse, error) {
	oauthForm := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"refresh_token": {refreshToken},
		"grant_type":    {"refresh_token"},
	}
	response, err := http.Post(
		"https://www.strava.com/oauth/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(oauthForm.Encode()),
	)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	var tokenResp TokenResponse
	return &tokenResp, json.NewDecoder(response.Body).Decode(&tokenResp)
}

// IsExpired reports whether the token needs refreshing.
// The 60-second buffer ensures we refresh before the token actually expires.
func IsExpired(expiresAt int64) bool {
	const refreshBufferSeconds = 60
	return time.Now().Unix() >= expiresAt-refreshBufferSeconds
}
