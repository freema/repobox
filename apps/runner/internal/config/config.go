package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	RunnerID        string
	RedisURL        string
	TempDir         string
	CleanupAfterJob bool
	JobTimeout      time.Duration
	EncryptionKey   string
}

func Load() (*Config, error) {
	return &Config{
		RunnerID:        getEnv("RUNNER_ID", "runner-1"),
		RedisURL:        getEnv("REDIS_URL", "redis://localhost:6379"),
		TempDir:         getEnv("TEMP_DIR", "/tmp/repobox"),
		CleanupAfterJob: getEnvBool("CLEANUP_AFTER_JOB", true),
		JobTimeout:      time.Duration(getEnvInt("JOB_TIMEOUT", 3600)) * time.Second,
		EncryptionKey:   getEnv("ENCRYPTION_KEY", ""),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		b, err := strconv.ParseBool(value)
		if err != nil {
			return defaultValue
		}
		return b
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		i, err := strconv.Atoi(value)
		if err != nil {
			return defaultValue
		}
		return i
	}
	return defaultValue
}
