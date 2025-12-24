package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/repobox/runner/internal/agent"
	"github.com/repobox/runner/internal/config"
	"github.com/repobox/runner/internal/crypto"
	"github.com/repobox/runner/internal/git"
	"github.com/repobox/runner/internal/job"
	rediskeys "github.com/repobox/runner/internal/redis"
	"github.com/repobox/runner/internal/worker"
)

// Executor handles job execution
type Executor struct {
	rdb       *redis.Client
	cfg       *config.Config
	decryptor *crypto.Decryptor
	agent     agent.Agent
	logger    *slog.Logger
}

// NewExecutor creates a new job executor
func NewExecutor(rdb *redis.Client, cfg *config.Config, logger *slog.Logger) (*Executor, error) {
	decryptor, err := crypto.NewDecryptor(cfg.EncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create decryptor: %w", err)
	}

	// Create AI agent
	agentCfg := &agent.Config{
		Enabled:        cfg.AIEnabled,
		Provider:       cfg.AIProvider,
		CLIPath:        cfg.AICLIPath,
		APIKey:         cfg.AIAPIKey,
		Timeout:        int(cfg.AITimeout.Seconds()),
		MaxOutputLines: cfg.AIMaxOutputLines,
	}
	aiAgent := agent.NewClaudeAgent(agentCfg, logger.With("component", "agent"))

	return &Executor{
		rdb:       rdb,
		cfg:       cfg,
		decryptor: decryptor,
		agent:     aiAgent,
		logger:    logger,
	}, nil
}

// Execute runs a job
func (e *Executor) Execute(ctx context.Context, msg *worker.JobMessage) error {
	j := msg.Job
	logger := e.logger.With("job_id", j.ID, "user_id", j.UserID, "repo", j.RepoName)

	// Create timeout context
	jobCtx, cancel := context.WithTimeout(ctx, e.cfg.JobTimeout)
	defer cancel()

	// Update job status to running
	if err := e.updateJobStatus(jobCtx, j.ID, job.StatusRunning, map[string]interface{}{
		"startedAt": time.Now().UnixMilli(),
	}); err != nil {
		return fmt.Errorf("failed to update status to running: %w", err)
	}

	// Create temp directory for this job
	workDir := filepath.Join(e.cfg.TempDir, j.ID)
	if err := os.MkdirAll(workDir, 0755); err != nil {
		return e.failJob(jobCtx, j.ID, fmt.Errorf("failed to create work dir: %w", err))
	}

	// Cleanup temp dir when done
	if e.cfg.CleanupAfterJob {
		defer func() {
			if err := os.RemoveAll(workDir); err != nil {
				logger.Warn("failed to cleanup work dir", "error", err)
			}
		}()
	}

	// Get provider info
	provider, err := e.getProviderInfo(jobCtx, j.UserID, msg.ProviderID)
	if err != nil {
		return e.failJob(jobCtx, j.ID, fmt.Errorf("failed to get provider: %w", err))
	}

	logger.Info("starting job execution")
	e.appendOutput(jobCtx, j.ID, "stdout", "runner", "Starting job execution...")

	// Clone repository
	logger.Info("cloning repository")
	e.appendOutput(jobCtx, j.ID, "stdout", "runner", fmt.Sprintf("Cloning %s...", j.RepoURL))

	g := git.NewWithOptions(git.Options{
		Token:       provider.Token,
		AuthorName:  e.cfg.GitAuthorName,
		AuthorEmail: e.cfg.GitAuthorEmail,
	})
	repoPath := filepath.Join(workDir, "repo")
	if err := g.Clone(jobCtx, j.RepoURL, repoPath); err != nil {
		return e.failJob(jobCtx, j.ID, fmt.Errorf("clone failed: %w", err))
	}

	e.appendOutput(jobCtx, j.ID, "stdout", "runner", "Clone completed.")

	// Detect default branch
	defaultBranch, err := e.getDefaultBranch(jobCtx, repoPath)
	if err != nil {
		defaultBranch = "main" // Fallback
	}

	// Create working branch
	branchName := fmt.Sprintf("repobox/%s", j.ID[:8])
	logger.Info("creating branch", "branch", branchName)
	e.appendOutput(jobCtx, j.ID, "stdout", "runner", fmt.Sprintf("Creating branch %s...", branchName))

	if err := g.CreateBranch(jobCtx, repoPath, branchName); err != nil {
		return e.failJob(jobCtx, j.ID, fmt.Errorf("create branch failed: %w", err))
	}

	// Execute AI agent
	logger.Info("executing AI agent", "environment", j.Environment)
	e.appendOutput(jobCtx, j.ID, "stdout", "runner", "Executing AI agent...")

	// Create output callback that streams to Redis
	outputCallback := func(stream string, source agent.OutputSource, line string) {
		e.appendOutput(jobCtx, j.ID, stream, string(source), line)
	}

	agentOpts := agent.ExecuteOptions{
		WorkDir:     repoPath,
		Prompt:      j.Prompt,
		Environment: j.Environment,
		JobID:       j.ID,
		Output:      outputCallback,
	}

	if err := e.agent.Execute(jobCtx, agentOpts); err != nil {
		return e.failJob(jobCtx, j.ID, fmt.Errorf("agent execution failed: %w", err))
	}

	// Commit changes
	logger.Info("committing changes")
	e.appendOutput(jobCtx, j.ID, "stdout", "runner", "Committing changes...")

	commitMsg := fmt.Sprintf("repobox: %s", truncateString(j.Prompt, 50))
	if err := g.Commit(jobCtx, repoPath, commitMsg); err != nil {
		return e.failJob(jobCtx, j.ID, fmt.Errorf("commit failed: %w", err))
	}

	// Get diff stats
	linesAdded, linesRemoved, _ := g.GetDiffStats(jobCtx, repoPath, defaultBranch)

	// Push branch
	logger.Info("pushing branch")
	e.appendOutput(jobCtx, j.ID, "stdout", "runner", "Pushing to remote...")

	if err := g.Push(jobCtx, repoPath, branchName); err != nil {
		return e.failJob(jobCtx, j.ID, fmt.Errorf("push failed: %w", err))
	}

	e.appendOutput(jobCtx, j.ID, "stdout", "runner", "Push completed successfully!")
	e.appendOutput(jobCtx, j.ID, "stdout", "runner", fmt.Sprintf("Branch '%s' is ready. Create a pull request when you're satisfied with the changes.", branchName))

	// Update job to success
	updateFields := map[string]interface{}{
		"finishedAt":   time.Now().UnixMilli(),
		"branch":       branchName,
		"linesAdded":   linesAdded,
		"linesRemoved": linesRemoved,
	}

	if err := e.updateJobStatus(jobCtx, j.ID, job.StatusSuccess, updateFields); err != nil {
		logger.Error("failed to update status to success", "error", err)
	}

	logger.Info("job completed successfully",
		"branch", branchName,
		"lines_added", linesAdded,
		"lines_removed", linesRemoved,
	)

	return nil
}

// providerInfo holds provider data needed for job execution
type providerInfo struct {
	Token string // Decrypted token
	Type  string // "gitlab" or "github"
	URL   string // Base URL (e.g., https://gitlab.com)
}

// getProviderInfo fetches provider details including decrypted token
func (e *Executor) getProviderInfo(ctx context.Context, userID, providerID string) (*providerInfo, error) {
	key := rediskeys.GitProviderKey(userID, providerID)

	e.logger.Debug("fetching provider info",
		"user_id", userID,
		"provider_id", providerID,
		"key", key,
	)

	data, err := e.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		e.logger.Debug("Redis error fetching provider", "error", err)
		return nil, err
	}
	if len(data) == 0 {
		e.logger.Debug("provider not found in Redis",
			"key", key,
			"user_id", userID,
			"provider_id", providerID,
		)
		return nil, fmt.Errorf("provider not found: %s", providerID)
	}

	e.logger.Debug("provider data from Redis",
		"provider_id", providerID,
		"type", data["type"],
		"url", data["url"],
		"has_token", data["token"] != "",
	)

	encryptedToken, ok := data["token"]
	if !ok {
		return nil, fmt.Errorf("token not found for provider: %s", providerID)
	}

	token, err := e.decryptor.Decrypt(encryptedToken)
	if err != nil {
		e.logger.Debug("failed to decrypt token", "error", err)
		return nil, fmt.Errorf("failed to decrypt token: %w", err)
	}

	e.logger.Debug("provider info loaded successfully",
		"provider_id", providerID,
		"type", data["type"],
	)

	return &providerInfo{
		Token: token,
		Type:  data["type"],
		URL:   data["url"],
	}, nil
}

// getDefaultBranch detects the default branch of the repository
func (e *Executor) getDefaultBranch(_ context.Context, _ string) (string, error) {
	// TODO: Implement proper detection using git symbolic-ref
	// For now, return "main" as default
	return "main", nil
}

// updateJobStatus updates job status in Redis
func (e *Executor) updateJobStatus(ctx context.Context, jobID string, status job.Status, fields map[string]interface{}) error {
	key := rediskeys.JobKey(jobID)

	updates := map[string]interface{}{
		"status": string(status),
	}

	for k, v := range fields {
		// Convert field names to snake_case for Redis
		redisKey := toSnakeCase(k)
		switch val := v.(type) {
		case int64:
			updates[redisKey] = val
		case int:
			updates[redisKey] = val
		case string:
			updates[redisKey] = val
		default:
			updates[redisKey] = fmt.Sprintf("%v", v)
		}
	}

	return e.rdb.HSet(ctx, key, updates).Err()
}

// failJob marks a job as failed and logs the error
func (e *Executor) failJob(ctx context.Context, jobID string, err error) error {
	e.appendOutput(ctx, jobID, "stderr", "runner", fmt.Sprintf("Error: %s", err.Error()))

	updateErr := e.updateJobStatus(ctx, jobID, job.StatusFailed, map[string]interface{}{
		"finishedAt":   time.Now().UnixMilli(),
		"errorMessage": err.Error(),
	})
	if updateErr != nil {
		e.logger.Error("failed to update job status to failed", "job_id", jobID, "error", updateErr)
	}

	return err
}

// appendOutput adds output line to job output list
func (e *Executor) appendOutput(ctx context.Context, jobID, stream, source, line string) {
	key := rediskeys.JobOutputKey(jobID)
	output := map[string]interface{}{
		"timestamp": time.Now().UnixMilli(),
		"line":      line,
		"stream":    stream,
		"source":    source,
	}
	data, _ := json.Marshal(output)
	e.rdb.RPush(ctx, key, string(data))
	e.rdb.Expire(ctx, key, 24*time.Hour)
}

// toSnakeCase converts camelCase to snake_case
func toSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteRune('_')
		}
		result.WriteRune(r)
	}
	return strings.ToLower(result.String())
}

// truncateString truncates a string to max length with ellipsis
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
