package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/repobox/runner/internal/job"
	rediskeys "github.com/repobox/runner/internal/redis"
	"github.com/repobox/runner/internal/worker"
)

// Consumer reads jobs from Redis stream
type Consumer struct {
	rdb            *redis.Client
	runnerID       string
	maxJobsPerUser int
	pool           *worker.Pool
	logger         *slog.Logger
}

// NewConsumer creates a new stream consumer
func NewConsumer(rdb *redis.Client, runnerID string, maxJobsPerUser int, pool *worker.Pool, logger *slog.Logger) *Consumer {
	return &Consumer{
		rdb:            rdb,
		runnerID:       runnerID,
		maxJobsPerUser: maxJobsPerUser,
		pool:           pool,
		logger:         logger,
	}
}

// Start begins consuming jobs from the stream
func (c *Consumer) Start(ctx context.Context) error {
	// Ensure consumer group exists
	if err := c.ensureConsumerGroup(ctx); err != nil {
		return err
	}

	c.logger.Info("consumer started",
		"runner_id", c.runnerID,
		"stream", rediskeys.JobsStream,
		"group", rediskeys.JobsConsumerGroup,
	)

	// First, claim any pending messages from crashed consumers
	if err := c.claimPendingMessages(ctx); err != nil {
		c.logger.Warn("failed to claim pending messages", "error", err)
	}

	// Main consumer loop
	for {
		select {
		case <-ctx.Done():
			c.logger.Info("consumer stopping")
			return ctx.Err()
		default:
		}

		// Read from stream with timeout
		streams, err := c.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    rediskeys.JobsConsumerGroup,
			Consumer: c.runnerID,
			Streams:  []string{rediskeys.JobsStream, ">"},
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if errors.Is(err, redis.Nil) {
				// No new messages, continue
				continue
			}
			if errors.Is(err, context.Canceled) {
				return nil
			}
			c.logger.Error("failed to read from stream", "error", err)
			time.Sleep(time.Second) // Back off on error
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				if err := c.processMessage(ctx, msg); err != nil {
					c.logger.Error("failed to process message",
						"stream_id", msg.ID,
						"error", err,
					)
				}
			}
		}
	}
}

// ensureConsumerGroup creates the consumer group if it doesn't exist
func (c *Consumer) ensureConsumerGroup(ctx context.Context) error {
	err := c.rdb.XGroupCreateMkStream(ctx, rediskeys.JobsStream, rediskeys.JobsConsumerGroup, "0").Err()
	if err != nil {
		// BUSYGROUP means group already exists - that's fine
		if err.Error() != "BUSYGROUP Consumer Group name already exists" {
			return err
		}
	}
	return nil
}

// claimPendingMessages claims old pending messages from dead consumers
func (c *Consumer) claimPendingMessages(ctx context.Context) error {
	// Get pending messages older than 5 minutes
	pending, err := c.rdb.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream: rediskeys.JobsStream,
		Group:  rediskeys.JobsConsumerGroup,
		Start:  "-",
		End:    "+",
		Count:  100,
	}).Result()

	if err != nil {
		return err
	}

	minIdleTime := 5 * time.Minute
	for _, p := range pending {
		if p.Idle < minIdleTime {
			continue
		}

		// Claim the message
		claimed, err := c.rdb.XClaim(ctx, &redis.XClaimArgs{
			Stream:   rediskeys.JobsStream,
			Group:    rediskeys.JobsConsumerGroup,
			Consumer: c.runnerID,
			MinIdle:  minIdleTime,
			Messages: []string{p.ID},
		}).Result()

		if err != nil {
			c.logger.Warn("failed to claim message", "id", p.ID, "error", err)
			continue
		}

		for _, msg := range claimed {
			c.logger.Info("claimed pending message", "id", msg.ID)
			if err := c.processMessage(ctx, msg); err != nil {
				c.logger.Error("failed to process claimed message", "id", msg.ID, "error", err)
			}
		}
	}

	return nil
}

// processMessage handles a single stream message
func (c *Consumer) processMessage(ctx context.Context, msg redis.XMessage) error {
	// Parse job from message
	jobMsg, err := c.parseMessage(msg)
	if err != nil {
		// Invalid message - ACK it to remove from stream
		c.rdb.XAck(ctx, rediskeys.JobsStream, rediskeys.JobsConsumerGroup, msg.ID)
		return err
	}

	// Check user limit
	userKey := rediskeys.UserRunningJobsKey(jobMsg.Job.UserID)
	running, err := c.rdb.Get(ctx, userKey).Int()
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	if running >= c.maxJobsPerUser {
		c.logger.Debug("user at job limit, skipping",
			"user_id", jobMsg.Job.UserID,
			"running", running,
			"limit", c.maxJobsPerUser,
		)
		// Don't ACK - let it be reprocessed later
		// Sleep briefly to avoid tight loop
		time.Sleep(100 * time.Millisecond)
		return nil
	}

	// Increment user's running count
	c.rdb.Incr(ctx, userKey)

	// Submit to worker pool
	c.pool.Submit(jobMsg)

	return nil
}

// parseMessage converts Redis stream message to JobMessage
func (c *Consumer) parseMessage(msg redis.XMessage) (*worker.JobMessage, error) {
	values := msg.Values

	// Get job ID from message
	jobID, ok := values["job_id"].(string)
	if !ok {
		return nil, errors.New("missing job_id in message")
	}

	// Fetch full job data from Redis hash
	jobKey := rediskeys.JobKey(jobID)
	jobData, err := c.rdb.HGetAll(context.Background(), jobKey).Result()
	if err != nil {
		return nil, err
	}
	if len(jobData) == 0 {
		return nil, errors.New("job not found: " + jobID)
	}

	// Parse job
	j, err := parseJobFromHash(jobData)
	if err != nil {
		return nil, err
	}

	// Get provider ID from message
	providerID, _ := values["provider_id"].(string)

	return &worker.JobMessage{
		StreamID:   msg.ID,
		Job:        j,
		ProviderID: providerID,
	}, nil
}

// parseJobFromHash converts Redis hash to Job struct
func parseJobFromHash(data map[string]string) (*job.Job, error) {
	j := &job.Job{
		ID:          data["id"],
		UserID:      data["userId"],
		ProviderID:  data["providerId"],
		RepoURL:     data["repoUrl"],
		RepoName:    data["repoName"],
		Branch:      data["branch"],
		Prompt:      data["prompt"],
		Environment: data["environment"],
		Status:      job.Status(data["status"]),
	}

	// Parse timestamps
	if v, ok := data["createdAt"]; ok {
		var ts int64
		json.Unmarshal([]byte(v), &ts)
		j.CreatedAt = time.UnixMilli(ts)
	}

	return j, nil
}

// AckJob acknowledges a job message and decrements user counter
func (c *Consumer) AckJob(ctx context.Context, msg *worker.JobMessage) error {
	// Decrement user's running count
	userKey := rediskeys.UserRunningJobsKey(msg.Job.UserID)
	c.rdb.Decr(ctx, userKey)

	// ACK the stream message
	return c.rdb.XAck(ctx, rediskeys.JobsStream, rediskeys.JobsConsumerGroup, msg.StreamID).Err()
}
