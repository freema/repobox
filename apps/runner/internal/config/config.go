package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	RunnerID          string
	RedisURL          string
	TempDir           string
	CleanupAfterJob   bool
	JobTimeout        time.Duration
	EncryptionKey     string
	MaxConcurrentJobs int
	MaxJobsPerUser    int

	// Logging
	LogLevel  string // debug, info, warn, error
	LogFormat string // json, text

	// Git commit identity
	GitAuthorName  string
	GitAuthorEmail string

	// Cleanup configuration
	CleanupOnStartup   bool          // Clean temp dir on startup
	CleanupInterval    time.Duration // Periodic cleanup interval (0 = disabled)
	CleanupMaxAge      time.Duration // Max age of temp files before cleanup
	CleanupMaxDiskMB   int           // Max disk usage in MB (0 = unlimited)

	// AI Agent configuration
	AIEnabled        bool
	AIProvider       string
	AICLIPath        string
	AIAPIKey         string
	AITimeout        time.Duration
	AIMaxOutputLines int
}

func Load() (*Config, error) {
	cfg := &Config{
		RunnerID:          getEnv("RUNNER_ID", "runner-1"),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379"),
		TempDir:           getEnv("TEMP_DIR", "/tmp/repobox"),
		CleanupAfterJob:   getEnvBool("CLEANUP_AFTER_JOB", true),
		JobTimeout:        time.Duration(getEnvInt("JOB_TIMEOUT", 3600)) * time.Second,
		EncryptionKey:     getEnv("ENCRYPTION_KEY", ""),
		MaxConcurrentJobs: getEnvInt("MAX_CONCURRENT_JOBS", 10),
		MaxJobsPerUser:    getEnvInt("MAX_JOBS_PER_USER", 3),

		// Logging
		LogLevel:  getEnv("LOG_LEVEL", "info"),
		LogFormat: getEnv("LOG_FORMAT", "json"),

		// Git commit identity
		GitAuthorName:  getEnv("GIT_AUTHOR_NAME", "Repobox Bot"),
		GitAuthorEmail: getEnv("GIT_AUTHOR_EMAIL", "bot@repobox.cloud"),

		// Cleanup configuration
		CleanupOnStartup:   getEnvBool("CLEANUP_ON_STARTUP", true),
		CleanupInterval:    time.Duration(getEnvInt("CLEANUP_INTERVAL_MINUTES", 30)) * time.Minute,
		CleanupMaxAge:      time.Duration(getEnvInt("CLEANUP_MAX_AGE_MINUTES", 120)) * time.Minute,
		CleanupMaxDiskMB:   getEnvInt("CLEANUP_MAX_DISK_MB", 0), // 0 = unlimited

		// AI Agent configuration
		AIEnabled:        getEnvBool("AI_ENABLED", true),
		AIProvider:       getEnv("AI_PROVIDER", "claude"),
		AICLIPath:        getEnv("AI_CLI_PATH", "claude"),
		AIAPIKey:         getEnv("ANTHROPIC_API_KEY", ""),
		AITimeout:        time.Duration(getEnvInt("AI_TIMEOUT", 1800)) * time.Second,
		AIMaxOutputLines: getEnvInt("AI_MAX_OUTPUT_LINES", 10000),
	}

	if cfg.EncryptionKey == "" {
		return nil, fmt.Errorf("ENCRYPTION_KEY is required")
	}

	// AI API key is optional - mock mode will be used if not provided
	if cfg.AIEnabled && cfg.AIAPIKey == "" {
		cfg.AIEnabled = false
	}

	return cfg, nil
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

// ParseLogLevel converts string log level to slog.Level
func ParseLogLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// NewLogger creates a new slog.Logger based on config
func (c *Config) NewLogger() *slog.Logger {
	level := ParseLogLevel(c.LogLevel)
	opts := &slog.HandlerOptions{
		Level: level,
	}

	var handler slog.Handler
	if c.LogFormat == "text" {
		handler = slog.NewTextHandler(os.Stdout, opts)
	} else {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	}

	return slog.New(handler)
}
