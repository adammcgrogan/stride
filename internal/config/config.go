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
}

func Load() *Config {
	godotenv.Load()
	return &Config{
		Addr:               getEnv("ADDR", ":8080"),
		DBPath:             getEnv("DB_PATH", "stride.db"),
		StravaClientID:     getEnv("STRAVA_CLIENT_ID", ""),
		StravaClientSecret: getEnv("STRAVA_CLIENT_SECRET", ""),
		StravaRedirectURL:  getEnv("STRAVA_REDIRECT_URL", "http://localhost:8080/auth/callback"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
