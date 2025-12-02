package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/repobox/runner/internal/config"
	"github.com/repobox/runner/internal/redis"
)

func main() {
	log.Println("Starting Repobox Runner...")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	redisClient, err := redis.NewClient(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	log.Printf("Runner %s connected to Redis", cfg.RunnerID)

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Shutting down runner...")
}
