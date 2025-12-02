package redis

import "fmt"

// Redis key patterns - must match web app keys.ts
const (
	// Stream keys
	JobsStream        = "jobs:stream"
	JobsConsumerGroup = "jobs:stream:runners"
)

// Key builders
func JobKey(jobID string) string {
	return fmt.Sprintf("job:%s", jobID)
}

func JobOutputKey(jobID string) string {
	return fmt.Sprintf("job:%s:output", jobID)
}

func GitProviderKey(userID, providerID string) string {
	return fmt.Sprintf("git_provider:%s:%s", userID, providerID)
}

func UserRunningJobsKey(userID string) string {
	return fmt.Sprintf("runner:user:%s:running", userID)
}
