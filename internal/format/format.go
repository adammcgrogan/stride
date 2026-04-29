package format

import (
	"fmt"
	"time"
)

func Date(s string) string {
	if len(s) < 10 {
		return s
	}
	t, err := time.Parse("2006-01-02", s[:10])
	if err != nil {
		return s[:10]
	}
	return t.Format("Jan 2, 2006")
}

func Duration(seconds int) string {
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

func RunTime(seconds int) string {
	if seconds == 0 {
		return "—"
	}
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}

func Pace(mps float64) string {
	if mps == 0 {
		return "—"
	}
	spk := 1000.0 / mps
	min := int(spk) / 60
	sec := int(spk) % 60
	return fmt.Sprintf("%d:%02d /km", min, sec)
}

func MaxSpeed(mps float64) string {
	if mps == 0 {
		return "—"
	}
	return fmt.Sprintf("%.1f km/h", mps*3.6)
}

func Float(f float64) string {
	if f == 0 {
		return "—"
	}
	return fmt.Sprintf("%.0f", f)
}

// DistanceKm returns meters formatted as "X.X" with no unit suffix.
func DistanceKm(meters float64) string {
	return fmt.Sprintf("%.1f", meters/1000)
}

// Distance returns meters formatted as "X.X km".
func Distance(meters float64) string {
	return fmt.Sprintf("%.1f km", meters/1000)
}

func RestTime(elapsed, moving int) string {
	rest := elapsed - moving
	if rest <= 0 {
		return ""
	}
	h := rest / 3600
	m := (rest % 3600) / 60
	s := rest % 60
	if h > 0 {
		return fmt.Sprintf("%dh %dm", h, m)
	}
	if m > 0 {
		return fmt.Sprintf("%dm %ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}

func FullName(first, last string) string {
	switch {
	case first == "" && last == "":
		return ""
	case last == "":
		return first
	case first == "":
		return last
	default:
		return first + " " + last
	}
}

func SportBadgeClass(sport string) string {
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
}

func WeatherDesc(code int) string {
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
}

func LastSync(unixTS int64) string {
	if unixTS == 0 {
		return "Never"
	}
	d := time.Since(time.Unix(unixTS, 0))
	switch {
	case d < time.Minute:
		return "Just now"
	case d < time.Hour:
		return fmt.Sprintf("%d min ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d hr ago", int(d.Hours()))
	default:
		return time.Unix(unixTS, 0).Format("Jan 2")
	}
}
