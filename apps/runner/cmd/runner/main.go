package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/repobox/runner/internal/cleanup"
	"github.com/repobox/runner/internal/config"
	"github.com/repobox/runner/internal/consumer"
	"github.com/repobox/runner/internal/executor"
	"github.com/repobox/runner/internal/redis"
	"github.com/repobox/runner/internal/session"
	"github.com/repobox/runner/internal/worker"
)

func main() {
	// Load config first to get log settings
	cfg, err := config.Load()
	if err != nil {
		// Fallback logger for config errors
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// Setup structured logging from config
	logger := cfg.NewLogger()
	slog.SetDefault(logger)

	logger.Info("Starting Repobox Runner...",
		"log_level", cfg.LogLevel,
		"log_format", cfg.LogFormat,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to Redis first (needed for cleanup)
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

	// Setup temp directory cleanup
	cleaner := cleanup.New(cleanup.Config{
		TempDir:       cfg.TempDir,
		OnStartup:     cfg.CleanupOnStartup,
		Interval:      cfg.CleanupInterval,
		MaxAge:        cfg.CleanupMaxAge,
		MaxDiskMB:     cfg.CleanupMaxDiskMB,
		SessionMaxAge: 24 * time.Hour, // Sessions timeout after 24h
	}, redisClient.Redis(), logger)

	// Run startup cleanup
	if err := cleaner.RunStartup(); err != nil {
		logger.Warn("Startup cleanup failed", "error", err)
	}

	// Start periodic cleanup
	cleaner.Start(ctx)

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

	// Start job consumer in goroutine
	go func() {
		if err := cons.Start(ctx); err != nil && err != context.Canceled {
			logger.Error("Job consumer error", "error", err)
		}
	}()

	// Start session consumer
	sessionConsumer, err := session.NewConsumer(redisClient.Redis(), cfg, logger)
	if err != nil {
		logger.Error("Failed to create session consumer", "error", err)
		os.Exit(1)
	}

	go func() {
		if err := sessionConsumer.Start(ctx); err != nil && err != context.Canceled {
			logger.Error("Session consumer error", "error", err)
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
