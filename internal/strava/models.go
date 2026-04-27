package strava

type Athlete struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
	City      string `json:"city"`
	Country   string `json:"country"`
	Profile   string `json:"profile"`
}

type Activity struct {
	ID                 int64   `json:"id"`
	Name               string  `json:"name"`
	Type               string  `json:"type"`
	SportType          string  `json:"sport_type"`
	Distance           float64 `json:"distance"`
	MovingTime         int     `json:"moving_time"`
	ElapsedTime        int     `json:"elapsed_time"`
	TotalElevationGain float64 `json:"total_elevation_gain"`
	StartDate          string  `json:"start_date"`
	StartDateLocal     string  `json:"start_date_local"`
	Timezone           string  `json:"timezone"`
	AverageSpeed       float64 `json:"average_speed"`
	MaxSpeed           float64 `json:"max_speed"`
	AverageHeartrate   float64 `json:"average_heartrate"`
	MaxHeartrate       float64 `json:"max_heartrate"`
	AverageCadence     float64 `json:"average_cadence"`
	AverageWatts       float64 `json:"average_watts"`
	Kilojoules         float64 `json:"kilojoules"`
	SufferScore        float64   `json:"suffer_score"`
	Map                Map       `json:"map"`
	StartLatLng        []float64 `json:"start_latlng"`
	SplitsMetric       []Split   `json:"splits_metric"`
	SplitsStandard     []Split   `json:"splits_standard"`
}

type Split struct {
	Distance            float64 `json:"distance"`
	ElapsedTime         int     `json:"elapsed_time"`
	MovingTime          int     `json:"moving_time"`
	ElevationDifference float64 `json:"elevation_difference"`
	SplitIndex          int     `json:"split"`
	AverageSpeed        float64 `json:"average_speed"`
	AverageHeartrate    float64 `json:"average_heartrate"`
	PaceZone            int     `json:"pace_zone"`
}

type Map struct {
	ID              string `json:"id"`
	SummaryPolyline string `json:"summary_polyline"`
	Polyline        string `json:"polyline"`
}

type TokenResponse struct {
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	ExpiresAt    int64   `json:"expires_at"`
	Athlete      Athlete `json:"athlete"`
}
