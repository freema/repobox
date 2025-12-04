package cleanup

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/redis/go-redis/v9"
	rediskeys "github.com/repobox/runner/internal/redis"
)

// Config holds cleanup configuration
type Config struct {
	TempDir        string
	OnStartup      bool          // Clean on startup
	Interval       time.Duration // Periodic cleanup interval (0 = disabled)
	MaxAge         time.Duration // Max age of directories before cleanup
	MaxDiskMB      int           // Max disk usage in MB (0 = unlimited)
	SessionMaxAge  time.Duration // Max age for sessions (24h default)
}

// Cleaner handles temp directory cleanup
type Cleaner struct {
	cfg    Config
	rdb    *redis.Client
	logger *slog.Logger
}

// New creates a new Cleaner
func New(cfg Config, rdb *redis.Client, logger *slog.Logger) *Cleaner {
	// Default session max age to 24 hours if not set
	if cfg.SessionMaxAge == 0 {
		cfg.SessionMaxAge = 24 * time.Hour
	}

	return &Cleaner{
		cfg:    cfg,
		rdb:    rdb,
		logger: logger.With("component", "cleanup"),
	}
}

// RunStartup performs startup cleanup if enabled
func (c *Cleaner) RunStartup() error {
	if !c.cfg.OnStartup {
		c.logger.Debug("startup cleanup disabled")
		return nil
	}

	c.logger.Info("running startup cleanup", "dir", c.cfg.TempDir)
	return c.cleanAll()
}

// Start begins periodic cleanup in a goroutine
func (c *Cleaner) Start(ctx context.Context) {
	if c.cfg.Interval <= 0 {
		c.logger.Debug("periodic cleanup disabled")
		return
	}

	c.logger.Info("starting periodic cleanup",
		"interval", c.cfg.Interval,
		"max_age", c.cfg.MaxAge,
		"max_disk_mb", c.cfg.MaxDiskMB,
	)

	go c.runPeriodic(ctx)
}

// runPeriodic runs cleanup at regular intervals
func (c *Cleaner) runPeriodic(ctx context.Context) {
	ticker := time.NewTicker(c.cfg.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			c.logger.Debug("periodic cleanup stopped")
			return
		case <-ticker.C:
			c.logger.Debug("running periodic cleanup")
			if err := c.cleanOld(); err != nil {
				c.logger.Warn("periodic cleanup failed", "error", err)
			}
			// Clean old sessions
			if err := c.cleanOldSessions(ctx); err != nil {
				c.logger.Warn("session cleanup failed", "error", err)
			}
			if c.cfg.MaxDiskMB > 0 {
				if err := c.enforceMaxDisk(); err != nil {
					c.logger.Warn("disk limit enforcement failed", "error", err)
				}
			}
		}
	}
}

// cleanAll removes all directories in temp dir
func (c *Cleaner) cleanAll() error {
	entries, err := os.ReadDir(c.cfg.TempDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // Dir doesn't exist yet, that's fine
		}
		return err
	}

	var removed int
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		path := filepath.Join(c.cfg.TempDir, entry.Name())
		if err := os.RemoveAll(path); err != nil {
			c.logger.Warn("failed to remove directory", "path", path, "error", err)
		} else {
			removed++
		}
	}

	c.logger.Info("startup cleanup complete", "removed", removed)
	return nil
}

// cleanOld removes directories older than MaxAge
func (c *Cleaner) cleanOld() error {
	entries, err := os.ReadDir(c.cfg.TempDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	cutoff := time.Now().Add(-c.cfg.MaxAge)
	var removed int

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			path := filepath.Join(c.cfg.TempDir, entry.Name())
			if err := os.RemoveAll(path); err != nil {
				c.logger.Warn("failed to remove old directory", "path", path, "error", err)
			} else {
				removed++
				c.logger.Debug("removed old directory", "path", path, "age", time.Since(info.ModTime()))
			}
		}
	}

	if removed > 0 {
		c.logger.Info("cleaned old directories", "removed", removed)
	}
	return nil
}

// enforceMaxDisk removes oldest directories until disk usage is under limit
func (c *Cleaner) enforceMaxDisk() error {
	usage, err := c.getDiskUsageMB()
	if err != nil {
		return err
	}

	if usage <= c.cfg.MaxDiskMB {
		return nil
	}

	c.logger.Info("disk usage exceeds limit, cleaning",
		"current_mb", usage,
		"limit_mb", c.cfg.MaxDiskMB,
	)

	// Get directories sorted by age (oldest first)
	dirs, err := c.getDirsByAge()
	if err != nil {
		return err
	}

	var removed int
	for _, dir := range dirs {
		if usage <= c.cfg.MaxDiskMB {
			break
		}

		dirSize, _ := c.getDirSizeMB(dir)
		if err := os.RemoveAll(dir); err != nil {
			c.logger.Warn("failed to remove directory for disk limit", "path", dir, "error", err)
			continue
		}

		removed++
		usage -= dirSize
		c.logger.Debug("removed directory for disk limit", "path", dir, "freed_mb", dirSize)
	}

	c.logger.Info("disk limit enforcement complete",
		"removed", removed,
		"new_usage_mb", usage,
	)
	return nil
}

// getDiskUsageMB returns total disk usage of temp dir in MB
func (c *Cleaner) getDiskUsageMB() (int, error) {
	var total int64

	err := filepath.Walk(c.cfg.TempDir, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Ignore errors, just skip
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})

	if err != nil && !os.IsNotExist(err) {
		return 0, err
	}

	return int(total / (1024 * 1024)), nil
}

// getDirSizeMB returns size of a directory in MB
func (c *Cleaner) getDirSizeMB(path string) (int, error) {
	var total int64

	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})

	if err != nil {
		return 0, err
	}

	return int(total / (1024 * 1024)), nil
}

// getDirsByAge returns directories sorted by modification time (oldest first)
func (c *Cleaner) getDirsByAge() ([]string, error) {
	entries, err := os.ReadDir(c.cfg.TempDir)
	if err != nil {
		return nil, err
	}

	type dirInfo struct {
		path    string
		modTime time.Time
	}

	var dirs []dirInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		dirs = append(dirs, dirInfo{
			path:    filepath.Join(c.cfg.TempDir, entry.Name()),
			modTime: info.ModTime(),
		})
	}

	// Sort by modTime ascending (oldest first)
	for i := 0; i < len(dirs)-1; i++ {
		for j := i + 1; j < len(dirs); j++ {
			if dirs[j].modTime.Before(dirs[i].modTime) {
				dirs[i], dirs[j] = dirs[j], dirs[i]
			}
		}
	}

	result := make([]string, len(dirs))
	for i, d := range dirs {
		result[i] = d.path
	}
	return result, nil
}

// cleanOldSessions removes work session directories that are too old or archived
func (c *Cleaner) cleanOldSessions(ctx context.Context) error {
	sessionsDir := filepath.Join(c.cfg.TempDir, "sessions")
	entries, err := os.ReadDir(sessionsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // Sessions dir doesn't exist yet
		}
		return err
	}

	cutoff := time.Now().Add(-c.cfg.SessionMaxAge)
	var removed int

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		sessionID := entry.Name()
		sessionPath := filepath.Join(sessionsDir, sessionID)

		// Check session status in Redis
		shouldClean := false
		reason := ""

		if c.rdb != nil {
			key := rediskeys.WorkSessionKey(sessionID)
			data, err := c.rdb.HGetAll(ctx, key).Result()
			if err == nil && len(data) > 0 {
				status := data["status"]

				// Clean if archived or pushed
				if status == "archived" || status == "pushed" {
					shouldClean = true
					reason = "status is " + status
				}

				// Check lastActivityAt
				if !shouldClean {
					var lastActivity int64
					if la, ok := data["last_activity_at"]; ok {
						fmt.Sscanf(la, "%d", &lastActivity)
						lastActivityTime := time.UnixMilli(lastActivity)
						if lastActivityTime.Before(cutoff) {
							shouldClean = true
							reason = "inactive for too long"
							// Update status to archived in Redis
							c.rdb.HSet(ctx, key, "status", "archived")
						}
					}
				}
			} else {
				// Session not in Redis - orphaned directory
				info, err := entry.Info()
				if err == nil && info.ModTime().Before(cutoff) {
					shouldClean = true
					reason = "orphaned directory"
				}
			}
		} else {
			// No Redis connection - fall back to filesystem age check
			info, err := entry.Info()
			if err == nil && info.ModTime().Before(cutoff) {
				shouldClean = true
				reason = "old directory (no Redis)"
			}
		}

		if shouldClean {
			if err := os.RemoveAll(sessionPath); err != nil {
				c.logger.Warn("failed to remove session directory",
					"session_id", sessionID,
					"path", sessionPath,
					"error", err,
				)
			} else {
				removed++
				c.logger.Debug("removed session directory",
					"session_id", sessionID,
					"reason", reason,
				)
			}
		}
	}

	if removed > 0 {
		c.logger.Info("cleaned old session directories", "removed", removed)
	}
	return nil
}
