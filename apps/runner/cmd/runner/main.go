package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/repobox/runner/internal/config"
	"github.com/repobox/runner/internal/consumer"
	"github.com/repobox/runner/internal/executor"
	"github.com/repobox/runner/internal/redis"
	"github.com/repobox/runner/internal/worker"
)

func main() {
	// Setup structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	logger.Info("Starting Repobox Runner...")

	cfg, err := config.Load()
	if err != nil {
		logger.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to Redis
	redisClient, err := redis.NewClient(ctx, cfg.RedisURL)
	if err != nil {
		logger.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()

	logger.Info("Connected to Redis",
		"runner_id", cfg.RunnerID,
		"max_concurrent_jobs", cfg.MaxConcurrentJobs,
		"max_jobs_per_user", cfg.MaxJobsPerUser,
	)

	// Create executor
	exec, err := executor.NewExecutor(redisClient.Redis(), cfg, logger)
	if err != nil {
		logger.Error("Failed to create executor", "error", err)
		os.Exit(1)
	}

	// Create consumer (needed for ACK)
	cons := consumer.NewConsumer(
		redisClient.Redis(),
		cfg.RunnerID,
		cfg.MaxJobsPerUser,
		nil, // Will set pool after creation
		logger,
	)

	// Job handler wraps executor + ACK
	jobHandler := func(ctx context.Context, msg *worker.JobMessage) error {
		err := exec.Execute(ctx, msg)
		// Always ACK and decrement counter, regardless of success/failure
		cons.AckJob(ctx, msg)
		return err
	}

	// Create worker pool
	pool := worker.NewPool(cfg.MaxConcurrentJobs, jobHandler, logger)

	// Update consumer with pool
	cons = consumer.NewConsumer(
		redisClient.Redis(),
		cfg.RunnerID,
		cfg.MaxJobsPerUser,
		pool,
		logger,
	)

	// Start worker pool
	pool.Start(ctx)

	// Start consumer in goroutine
	go func() {
		if err := cons.Start(ctx); err != nil && err != context.Canceled {
			logger.Error("Consumer error", "error", err)
		}
	}()

	logger.Info("Runner started and waiting for jobs")

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	logger.Info("Received shutdown signal", "signal", sig.String())

	// Cancel context to stop consumer
	cancel()

	// Stop worker pool (waits for in-flight jobs)
	pool.Stop()

	logger.Info("Runner shutdown complete")
}
