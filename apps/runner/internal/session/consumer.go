package session

import (
	"context"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/repobox/runner/internal/config"
	rediskeys "github.com/repobox/runner/internal/redis"
)

// Consumer handles consuming messages from work session streams
type Consumer struct {
	rdb          *redis.Client
	cfg          *config.Config
	runnerID     string
	initExecutor *InitExecutor
	jobExecutor  *JobExecutor
	pushExecutor *PushExecutor
	logger       *slog.Logger
}

// NewConsumer creates a new session consumer
func NewConsumer(rdb *redis.Client, cfg *config.Config, logger *slog.Logger) (*Consumer, error) {
	initExec, err := NewInitExecutor(rdb, cfg, logger)
	if err != nil {
		return nil, err
	}

	pushExec, err := NewPushExecutor(rdb, cfg, logger)
	if err != nil {
		return nil, err
	}

	return &Consumer{
		rdb:          rdb,
		cfg:          cfg,
		runnerID:     cfg.RunnerID,
		initExecutor: initExec,
		jobExecutor:  NewJobExecutor(rdb, cfg, logger),
		pushExecutor: pushExec,
		logger:       logger.With("component", "session-consumer"),
	}, nil
}

// Start begins consuming from all work session streams
func (c *Consumer) Start(ctx context.Context) error {
	// Ensure consumer groups exist
	if err := c.ensureConsumerGroups(ctx); err != nil {
		return err
	}

	c.logger.Info("session consumer started",
		"runner_id", c.runnerID,
	)

	// Start consumers for each stream
	go c.consumeInit(ctx)
	go c.consumeJobs(ctx)
	go c.consumePush(ctx)

	<-ctx.Done()
	c.logger.Info("session consumer stopped")
	return nil
}

// ensureConsumerGroups creates consumer groups if they don't exist
func (c *Consumer) ensureConsumerGroups(ctx context.Context) error {
	streams := []struct {
		key   string
		group string
	}{
		{rediskeys.WorkSessionsInitStream, rediskeys.WorkSessionsInitConsumerGroup},
		{rediskeys.WorkSessionsJobsStream, rediskeys.WorkSessionsJobsConsumerGroup},
		{rediskeys.WorkSessionsPushStream, rediskeys.WorkSessionsPushConsumerGroup},
	}

	for _, s := range streams {
		err := c.rdb.XGroupCreateMkStream(ctx, s.key, s.group, "0").Err()
		if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
			c.logger.Warn("failed to create consumer group", "stream", s.key, "error", err)
		}
	}

	return nil
}

// consumeInit consumes from the init stream
func (c *Consumer) consumeInit(ctx context.Context) {
	c.consumeStream(ctx, rediskeys.WorkSessionsInitStream, rediskeys.WorkSessionsInitConsumerGroup, func(fields map[string]string) {
		msg := &InitMessage{
			SessionID:  fields["session_id"],
			UserID:     fields["user_id"],
			ProviderID: fields["provider_id"],
			RepoURL:    fields["repo_url"],
			RepoName:   fields["repo_name"],
			BaseBranch: fields["base_branch"],
		}

		if err := c.initExecutor.Execute(ctx, msg); err != nil {
			c.logger.Error("init execution failed", "session_id", msg.SessionID, "error", err)
		}
	})
}

// consumeJobs consumes from the jobs stream
func (c *Consumer) consumeJobs(ctx context.Context) {
	c.consumeStream(ctx, rediskeys.WorkSessionsJobsStream, rediskeys.WorkSessionsJobsConsumerGroup, func(fields map[string]string) {
		msg := &JobMessage{
			SessionID:   fields["session_id"],
			JobID:       fields["job_id"],
			UserID:      fields["user_id"],
			Prompt:      fields["prompt"],
			Environment: fields["environment"],
		}

		if err := c.jobExecutor.Execute(ctx, msg); err != nil {
			c.logger.Error("job execution failed", "session_id", msg.SessionID, "job_id", msg.JobID, "error", err)
		}
	})
}

// consumePush consumes from the push stream
func (c *Consumer) consumePush(ctx context.Context) {
	c.consumeStream(ctx, rediskeys.WorkSessionsPushStream, rediskeys.WorkSessionsPushConsumerGroup, func(fields map[string]string) {
		msg := &PushMessage{
			SessionID:   fields["session_id"],
			UserID:      fields["user_id"],
			Title:       fields["title"],
			Description: fields["description"],
		}

		if err := c.pushExecutor.Execute(ctx, msg); err != nil {
			c.logger.Error("push execution failed", "session_id", msg.SessionID, "error", err)
		}
	})
}

// consumeStream is a generic stream consumer
func (c *Consumer) consumeStream(ctx context.Context, streamKey, groupName string, handler func(fields map[string]string)) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// Read from stream
		streams, err := c.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    groupName,
			Consumer: c.runnerID,
			Streams:  []string{streamKey, ">"},
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err == redis.Nil {
				continue // No new messages
			}
			c.logger.Debug("stream read error", "stream", streamKey, "error", err)
			time.Sleep(time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				// Convert values to string map
				fields := make(map[string]string)
				for k, v := range msg.Values {
					if str, ok := v.(string); ok {
						fields[k] = str
					}
				}

				// Handle message
				handler(fields)

				// ACK message
				if err := c.rdb.XAck(ctx, streamKey, groupName, msg.ID).Err(); err != nil {
					c.logger.Warn("failed to ACK message", "stream", streamKey, "id", msg.ID, "error", err)
				}
			}
		}
	}
}
