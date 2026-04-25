package strava

import "fmt"

func (c *Client) GetActivities(page, perPage int) ([]Activity, error) {
	var activities []Activity
	path := fmt.Sprintf("/athlete/activities?page=%d&per_page=%d", page, perPage)
	if err := c.get(path, &activities); err != nil {
		return nil, err
	}
	return activities, nil
}

func (c *Client) GetActivity(id int64) (*Activity, error) {
	var activity Activity
	if err := c.get(fmt.Sprintf("/activities/%d", id), &activity); err != nil {
		return nil, err
	}
	return &activity, nil
}

// GetAllActivities pages through all activities until Strava returns a partial page,
// indicating we have reached the end.
func (c *Client) GetAllActivities() ([]Activity, error) {
	const pageSize = 200
	var allActivities []Activity
	for page := 1; ; page++ {
		activitiesPage, err := c.GetActivities(page, pageSize)
		if err != nil {
			return nil, err
		}
		allActivities = append(allActivities, activitiesPage...)
		if len(activitiesPage) < pageSize {
			break
		}
	}
	return allActivities, nil
}
