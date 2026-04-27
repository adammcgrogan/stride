package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Addr               string
	DBPath             string
	StravaClientID     string
	StravaClientSecret string
	StravaRedirectURL  string
	SessionSecret      string
}

// Production returns true when a SESSION_SECRET is set, enabling signed cookies
// and the Secure cookie flag.
func (c *Config) Production() bool {
	return c.SessionSecret != ""
}

func Load() *Config {
	godotenv.Load()
	return &Config{
		Addr:               getEnv("ADDR", ":8080"),
		DBPath:             getEnv("DB_PATH", "stride.db"),
		StravaClientID:     getEnv("STRAVA_CLIENT_ID", ""),
		StravaClientSecret: getEnv("STRAVA_CLIENT_SECRET", ""),
		StravaRedirectURL:  getEnv("STRAVA_REDIRECT_URL", "http://localhost:8080/auth/callback"),
		SessionSecret:      getEnv("SESSION_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
