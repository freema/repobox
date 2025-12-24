package session

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/repobox/runner/internal/agent"
	"github.com/repobox/runner/internal/config"
	"github.com/repobox/runner/internal/git"
	"github.com/repobox/runner/internal/job"
	rediskeys "github.com/repobox/runner/internal/redis"
)

// JobExecutor handles running prompts within a work session
type JobExecutor struct {
	rdb    *redis.Client
	cfg    *config.Config
	agent  agent.Agent
	logger *slog.Logger
}

// NewJobExecutor creates a new job executor
func NewJobExecutor(rdb *redis.Client, cfg *config.Config, logger *slog.Logger) *JobExecutor {
	agentCfg := &agent.Config{
		Enabled:        cfg.AIEnabled,
		Provider:       cfg.AIProvider,
		CLIPath:        cfg.AICLIPath,
		APIKey:         cfg.AIAPIKey,
		Timeout:        int(cfg.AITimeout.Seconds()),
		MaxOutputLines: cfg.AIMaxOutputLines,
	}
	aiAgent := agent.NewClaudeAgent(agentCfg, logger.With("component", "agent"))

	return &JobExecutor{
		rdb:    rdb,
		cfg:    cfg,
		agent:  aiAgent,
		logger: logger.With("component", "session-job-executor"),
	}
}

// Execute runs a prompt within an existing work session
func (e *JobExecutor) Execute(ctx context.Context, msg *JobMessage) error {
	logger := e.logger.With(
		"session_id", msg.SessionID,
		"job_id", msg.JobID,
		"user_id", msg.UserID,
	)

	logger.Info("executing prompt in work session")

	// Verify workdir exists
	workDir := e.getSessionWorkDir(msg.SessionID)
	repoPath := filepath.Join(workDir, "repo")

	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return e.failJob(ctx, msg, fmt.Errorf("session workdir not found"))
	}

	// Update job status to running
	if err := e.updateJobStatus(ctx, msg.JobID, job.StatusRunning, map[string]interface{}{
		"started_at": time.Now().UnixMilli(),
	}); err != nil {
		logger.Warn("failed to update job status", "error", err)
	}

	e.appendOutput(ctx, msg.SessionID, "stdout", "runner", fmt.Sprintf("Running prompt: %s", truncateString(msg.Prompt, 100)))

	// Create output callback that streams to both session and job output
	outputCallback := func(stream string, source agent.OutputSource, line string) {
		e.appendOutput(ctx, msg.SessionID, stream, string(source), line)
	}

	// Execute AI agent
	agentOpts := agent.ExecuteOptions{
		WorkDir:     repoPath,
		Prompt:      msg.Prompt,
		Environment: msg.Environment,
		JobID:       msg.JobID,
		Output:      outputCallback,
	}

	if err := e.agent.Execute(ctx, agentOpts); err != nil {
		return e.failJob(ctx, msg, fmt.Errorf("agent execution failed: %w", err))
	}

	// Get diff stats for uncommitted changes
	g := git.New()
	linesAdded, linesRemoved, _ := g.GetUncommittedDiffStats(ctx, repoPath)

	// Update job status to success
	if err := e.updateJobStatus(ctx, msg.JobID, job.StatusSuccess, map[string]interface{}{
		"finished_at":   time.Now().UnixMilli(),
		"lines_added":   linesAdded,
		"lines_removed": linesRemoved,
	}); err != nil {
		logger.Warn("failed to update job status", "error", err)
	}

	// Update session status back to ready and increment job count
	session, _ := e.getSession(ctx, msg.SessionID)
	jobCount := 1
	if session != nil {
		jobCount = session.JobCount + 1
	}

	if err := e.updateSessionStatus(ctx, msg.SessionID, StatusReady, map[string]interface{}{
		"job_count":           jobCount,
		"total_lines_added":   linesAdded,
		"total_lines_removed": linesRemoved,
		"error_message":       "", // Clear error on success
		"last_job_status":     string(job.StatusSuccess),
	}); err != nil {
		logger.Warn("failed to update session status", "error", err)
	}

	e.appendOutput(ctx, msg.SessionID, "stdout", "runner", "Prompt completed. Session ready for more prompts or push.")

	logger.Info("prompt executed successfully",
		"lines_added", linesAdded,
		"lines_removed", linesRemoved,
	)

	return nil
}

// getSessionWorkDir returns the workdir path for a session
func (e *JobExecutor) getSessionWorkDir(sessionID string) string {
	return filepath.Join(e.cfg.TempDir, "sessions", sessionID)
}

// getSession fetches session from Redis
func (e *JobExecutor) getSession(ctx context.Context, sessionID string) (*Session, error) {
	key := rediskeys.WorkSessionKey(sessionID)
	data, err := e.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("session not found")
	}

	// Parse job count
	jobCount := 0
	if jc, ok := data["job_count"]; ok {
		fmt.Sscanf(jc, "%d", &jobCount)
	}

	return &Session{
		ID:       data["id"],
		Status:   Status(data["status"]),
		JobCount: jobCount,
	}, nil
}

// updateJobStatus updates job status in Redis
func (e *JobExecutor) updateJobStatus(ctx context.Context, jobID string, status job.Status, fields map[string]interface{}) error {
	key := rediskeys.JobKey(jobID)

	updates := map[string]interface{}{
		"status": string(status),
	}

	for k, v := range fields {
		updates[k] = v
	}

	return e.rdb.HSet(ctx, key, updates).Err()
}

// updateSessionStatus updates session status in Redis
func (e *JobExecutor) updateSessionStatus(ctx context.Context, sessionID string, status Status, fields map[string]interface{}) error {
	key := rediskeys.WorkSessionKey(sessionID)

	updates := map[string]interface{}{
		"status":           string(status),
		"last_activity_at": time.Now().UnixMilli(),
	}

	for k, v := range fields {
		updates[k] = v
	}

	return e.rdb.HSet(ctx, key, updates).Err()
}

// failJob marks a job as failed
func (e *JobExecutor) failJob(ctx context.Context, msg *JobMessage, err error) error {
	e.appendOutput(ctx, msg.SessionID, "stderr", "runner", fmt.Sprintf("Error: %s", err.Error()))

	// Mark job as failed
	e.updateJobStatus(ctx, msg.JobID, job.StatusFailed, map[string]interface{}{
		"finished_at":   time.Now().UnixMilli(),
		"error_message": err.Error(),
	})

	// Session stays ready so user can try again, but store error info for UI
	e.updateSessionStatus(ctx, msg.SessionID, StatusReady, map[string]interface{}{
		"error_message":   err.Error(),
		"last_job_status": string(job.StatusFailed),
	})

	return err
}

// appendOutput adds output line to session output list
func (e *JobExecutor) appendOutput(ctx context.Context, sessionID, stream, source, line string) {
	key := rediskeys.WorkSessionOutputKey(sessionID)
	output := map[string]interface{}{
		"timestamp": time.Now().UnixMilli(),
		"line":      line,
		"stream":    stream,
		"source":    source,
	}
	data, _ := json.Marshal(output)
	e.rdb.RPush(ctx, key, string(data))
	e.rdb.Expire(ctx, key, 7*24*time.Hour)
}

// truncateString truncates a string to max length
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
