package redis

import "fmt"

// Redis key patterns - must match web app keys.ts
const (
	// Job stream keys (legacy single-shot jobs)
	JobsStream        = "jobs:stream"
	JobsConsumerGroup = "jobs:stream:runners"

	// Work Session stream keys
	WorkSessionsInitStream         = "work_sessions:init:stream"
	WorkSessionsInitConsumerGroup  = "work_sessions:init:runners"
	WorkSessionsJobsStream         = "work_sessions:jobs:stream"
	WorkSessionsJobsConsumerGroup  = "work_sessions:jobs:runners"
	WorkSessionsPushStream         = "work_sessions:push:stream"
	WorkSessionsPushConsumerGroup  = "work_sessions:push:runners"
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

// Work Session key builders
func WorkSessionKey(sessionID string) string {
	return fmt.Sprintf("work_session:%s", sessionID)
}

func WorkSessionOutputKey(sessionID string) string {
	return fmt.Sprintf("work_session:%s:output", sessionID)
}

func WorkSessionJobsKey(sessionID string) string {
	return fmt.Sprintf("work_session:%s:jobs", sessionID)
}
