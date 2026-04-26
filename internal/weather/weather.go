package weather

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type Conditions struct {
	TempC    float64
	WindKph  float64
	PrecipMM float64
	Code     int
}

type response struct {
	Hourly struct {
		Time        []string  `json:"time"`
		Temperature []float64 `json:"temperature_2m"`
		WindSpeed   []float64 `json:"wind_speed_10m"`
		Precip      []float64 `json:"precipitation"`
		Code        []int     `json:"weather_code"`
	} `json:"hourly"`
	Error  bool   `json:"error"`
	Reason string `json:"reason"`
}

// Fetch returns weather conditions for the hour matching dateLocal.
// dateLocal is the Strava start_date_local field ("2024-01-15T09:30:00Z").
// Uses the Open-Meteo archive API — free, no key required.
func Fetch(lat, lng float64, dateLocal string) (*Conditions, error) {
	if len(dateLocal) < 10 {
		return nil, fmt.Errorf("invalid date: %q", dateLocal)
	}
	date := dateLocal[:10]
	url := fmt.Sprintf(
		"https://archive-api.open-meteo.com/v1/archive?latitude=%.4f&longitude=%.4f&start_date=%s&end_date=%s&hourly=temperature_2m,wind_speed_10m,precipitation,weather_code&timezone=auto",
		lat, lng, date, date,
	)

	resp, err := http.Get(url) //nolint:noctx
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data response
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Error {
		return nil, fmt.Errorf("open-meteo: %s", data.Reason)
	}
	if len(data.Hourly.Time) == 0 {
		return nil, fmt.Errorf("no hourly data for %s", date)
	}

	// Match the hour of the activity start time.
	// Strava local time: "2024-01-15T09:30:00Z" → prefix "2024-01-15T09"
	// Open-Meteo times:  "2024-01-15T09:00"
	hourPrefix := ""
	if len(dateLocal) >= 13 {
		hourPrefix = dateLocal[:13]
	}

	idx := 0
	for i, t := range data.Hourly.Time {
		if strings.HasPrefix(t, hourPrefix) {
			idx = i
			break
		}
	}

	code := 0
	if idx < len(data.Hourly.Code) {
		code = data.Hourly.Code[idx]
	}

	return &Conditions{
		TempC:    data.Hourly.Temperature[idx],
		WindKph:  data.Hourly.WindSpeed[idx],
		PrecipMM: data.Hourly.Precip[idx],
		Code:     code,
	}, nil
}
