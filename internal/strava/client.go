package strava

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const baseURL = "https://www.strava.com/api/v3"

type Client struct {
	http        *http.Client
	accessToken string
}

func NewClient(accessToken string) *Client {
	return &Client{
		http:        &http.Client{Timeout: 10 * time.Second},
		accessToken: accessToken,
	}
}

func (c *Client) get(path string, result any) error {
	req, err := http.NewRequest(http.MethodGet, baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)

	response, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("strava: %s returned %d", path, response.StatusCode)
	}

	return json.NewDecoder(response.Body).Decode(result)
}
