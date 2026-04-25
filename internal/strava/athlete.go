package strava

func (c *Client) GetAthlete() (*Athlete, error) {
	var athlete Athlete
	if err := c.get("/athlete", &athlete); err != nil {
		return nil, err
	}
	return &athlete, nil
}
