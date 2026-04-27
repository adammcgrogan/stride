package card

import (
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

const (
	cardW = 1200
	cardH = 630
)

var (
	colBG     = color.RGBA{0x0d, 0x0f, 0x14, 0xff}
	colAccent = color.RGBA{0xfc, 0x4c, 0x02, 0xff}
	colText   = color.RGBA{0xf1, 0xf3, 0xf9, 0xff}
	colMuted  = color.RGBA{0x8b, 0x97, 0xaa, 0xff}
	colRule   = color.RGBA{0x25, 0x29, 0x33, 0xff}
)

// Activity holds the values needed to render a share card.
type Activity struct {
	AthleteName string
	Name        string
	SportType   string
	Date        string
	Distance    string
	MovingTime  string
	Pace        string
	Elevation   string
}

// Render draws a 1200×630 PNG share card and writes it to w.
func Render(w io.Writer, a Activity) error {
	img := image.NewRGBA(image.Rect(0, 0, cardW, cardH))

	fillRect(img, 0, 0, cardW, cardH, colBG)
	fillRect(img, 0, 0, cardW, 8, colAccent)

	bold56, err := loadFace(gobold.TTF, 56)
	if err != nil {
		return err
	}
	defer bold56.Close()

	bold44, err := loadFace(gobold.TTF, 44)
	if err != nil {
		return err
	}
	defer bold44.Close()

	bold28, err := loadFace(gobold.TTF, 28)
	if err != nil {
		return err
	}
	defer bold28.Close()

	reg21, err := loadFace(goregular.TTF, 21)
	if err != nil {
		return err
	}
	defer reg21.Close()

	reg16, err := loadFace(goregular.TTF, 16)
	if err != nil {
		return err
	}
	defer reg16.Close()

	const padL, padR = 72, 72

	// Brand — top right
	brand := "Stride"
	brandW := measureText(bold28, brand)
	drawText(img, bold28, colAccent, cardW-padR-brandW, 108, brand)

	// Athlete name — small caps style, muted
	titleY := 220
	if a.AthleteName != "" {
		drawText(img, reg21, colMuted, padL, 158, strings.ToUpper(a.AthleteName))
		titleY = 248
	}

	// Activity name — large, truncated to fit
	maxTitleW := cardW - padL - padR
	title := truncate(bold56, a.Name, maxTitleW)
	drawText(img, bold56, colText, padL, titleY, title)

	// Sport · Date
	meta := a.SportType
	if a.Date != "" {
		meta += " · " + a.Date
	}
	drawText(img, reg21, colMuted, padL, titleY+46, meta)

	// Rule
	const ruleY = 380
	fillRect(img, padL, ruleY, cardW-padL-padR, 1, colRule)

	// Stats
	type stat struct{ value, label string }
	stats := []stat{
		{a.Distance, "DISTANCE"},
		{a.MovingTime, "TIME"},
		{a.Pace, "PACE"},
		{a.Elevation, "ELEVATION"},
	}
	colW := (cardW - padL - padR) / len(stats)
	for i, s := range stats {
		x := padL + i*colW
		drawText(img, bold44, colText, x, 460, s.value)
		drawText(img, reg16, colMuted, x, 490, s.label)
	}

	return png.Encode(w, img)
}

func loadFace(ttf []byte, size float64) (font.Face, error) {
	f, err := opentype.Parse(ttf)
	if err != nil {
		return nil, err
	}
	return opentype.NewFace(f, &opentype.FaceOptions{
		Size:    size,
		DPI:     72,
		Hinting: font.HintingFull,
	})
}

func drawText(img *image.RGBA, face font.Face, col color.Color, x, y int, s string) {
	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(col),
		Face: face,
		Dot:  fixed.P(x, y),
	}
	d.DrawString(s)
}

func measureText(face font.Face, s string) int {
	d := &font.Drawer{Face: face}
	return d.MeasureString(s).Ceil()
}

func truncate(face font.Face, s string, maxW int) string {
	if measureText(face, s) <= maxW {
		return s
	}
	runes := []rune(s)
	for len(runes) > 0 {
		runes = runes[:len(runes)-1]
		if measureText(face, string(runes)+"…") <= maxW {
			return string(runes) + "…"
		}
	}
	return "…"
}

func fillRect(img *image.RGBA, x, y, w, h int, c color.Color) {
	draw.Draw(img, image.Rect(x, y, x+w, y+h), image.NewUniform(c), image.Point{}, draw.Over)
}
