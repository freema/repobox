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
	"github.com/repobox/runner/internal/config"
	"github.com/repobox/runner/internal/crypto"
	"github.com/repobox/runner/internal/git"
	"github.com/repobox/runner/internal/mergerequest"
	rediskeys "github.com/repobox/runner/internal/redis"
)

// PushExecutor handles pushing work session branch and creating MR/PR
type PushExecutor struct {
	rdb       *redis.Client
	cfg       *config.Config
	decryptor *crypto.Decryptor
	logger    *slog.Logger
}

// NewPushExecutor creates a new push executor
func NewPushExecutor(rdb *redis.Client, cfg *config.Config, logger *slog.Logger) (*PushExecutor, error) {
	decryptor, err := crypto.NewDecryptor(cfg.EncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create decryptor: %w", err)
	}

	return &PushExecutor{
		rdb:       rdb,
		cfg:       cfg,
		decryptor: decryptor,
		logger:    logger.With("component", "session-push-executor"),
	}, nil
}

// Execute pushes the work session branch and creates MR/PR
func (e *PushExecutor) Execute(ctx context.Context, msg *PushMessage) error {
	logger := e.logger.With(
		"session_id", msg.SessionID,
		"user_id", msg.UserID,
	)

	logger.Info("pushing work session")

	// Get session info
	session, err := e.getSession(ctx, msg.SessionID)
	if err != nil {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("failed to get session: %w", err))
	}

	// Verify workdir exists
	workDir := e.getSessionWorkDir(msg.SessionID)
	repoPath := filepath.Join(workDir, "repo")

	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("session workdir not found"))
	}

	// Get provider info
	provider, err := e.getProviderInfo(ctx, msg.UserID, session.ProviderID)
	if err != nil {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("failed to get provider: %w", err))
	}

	e.appendOutput(ctx, msg.SessionID, "stdout", "Pushing branch to remote...")

	// Push branch
	g := git.NewWithOptions(git.Options{
		Token:       provider.Token,
		AuthorName:  e.cfg.GitAuthorName,
		AuthorEmail: e.cfg.GitAuthorEmail,
	})

	if err := g.Push(ctx, repoPath, session.WorkBranch); err != nil {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("push failed: %w", err))
	}

	e.appendOutput(ctx, msg.SessionID, "stdout", "Push completed.")

	// Create MR/PR
	mrURL, mrWarning := e.createMergeRequest(ctx, session, provider, msg)

	updates := map[string]interface{}{
		"pushed_at": time.Now().UnixMilli(),
	}

	if mrURL != "" {
		updates["mr_url"] = mrURL
		e.appendOutput(ctx, msg.SessionID, "stdout", fmt.Sprintf("Merge request created: %s", mrURL))
	}
	if mrWarning != "" {
		updates["mr_warning"] = mrWarning
		e.appendOutput(ctx, msg.SessionID, "stderr", fmt.Sprintf("Warning: %s", mrWarning))
	}

	// Update session status to pushed
	if err := e.updateSessionStatus(ctx, msg.SessionID, StatusPushed, updates); err != nil {
		logger.Warn("failed to update session status", "error", err)
	}

	logger.Info("work session pushed successfully",
		"mr_url", mrURL,
		"mr_warning", mrWarning,
	)

	return nil
}

// createMergeRequest creates a MR/PR and returns the URL or warning message
func (e *PushExecutor) createMergeRequest(
	ctx context.Context,
	session *Session,
	provider *providerInfo,
	msg *PushMessage,
) (mrURL string, warning string) {
	// Extract project ID from repo URL
	projectID, err := mergerequest.ExtractProjectID(session.RepoURL)
	if err != nil {
		return "", fmt.Sprintf("Failed to extract project ID: %s", err)
	}

	// Get the appropriate client
	var creator mergerequest.Creator
	switch provider.Type {
	case "github":
		creator = mergerequest.NewGitHubClient()
	case "gitlab":
		creator = mergerequest.NewGitLabClient()
	default:
		return "", fmt.Sprintf("Unknown provider type: %s", provider.Type)
	}

	// Generate title and description
	title := msg.Title
	if title == "" {
		title = fmt.Sprintf("repobox: Work session %s", session.ID[:8])
	}

	description := msg.Description
	if description == "" {
		description = mergerequest.GenerateDescription(mergerequest.TemplateParams{
			Prompt:       fmt.Sprintf("Work session with %d prompts", session.JobCount),
			LinesAdded:   session.TotalLinesAdded,
			LinesRemoved: session.TotalLinesRemoved,
			BranchName:   session.WorkBranch,
			JobID:        session.ID,
		})
	}

	e.appendOutput(ctx, session.ID, "stdout", "Creating merge request...")

	result, err := creator.Create(mergerequest.CreateParams{
		Token:        provider.Token,
		BaseURL:      provider.URL,
		ProjectID:    projectID,
		Title:        title,
		Description:  description,
		SourceBranch: session.WorkBranch,
		TargetBranch: session.BaseBranch,
	})

	if err != nil {
		return "", fmt.Sprintf("Failed to create merge request: %s", err)
	}

	return result.URL, ""
}

// getSessionWorkDir returns the workdir path for a session
func (e *PushExecutor) getSessionWorkDir(sessionID string) string {
	return filepath.Join(e.cfg.TempDir, "sessions", sessionID)
}

// getSession fetches session from Redis
func (e *PushExecutor) getSession(ctx context.Context, sessionID string) (*Session, error) {
	key := rediskeys.WorkSessionKey(sessionID)
	data, err := e.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("session not found")
	}

	// Parse numeric fields
	jobCount := 0
	linesAdded := 0
	linesRemoved := 0
	fmt.Sscanf(data["job_count"], "%d", &jobCount)
	fmt.Sscanf(data["total_lines_added"], "%d", &linesAdded)
	fmt.Sscanf(data["total_lines_removed"], "%d", &linesRemoved)

	return &Session{
		ID:                data["id"],
		UserID:            data["user_id"],
		ProviderID:        data["provider_id"],
		RepoURL:           data["repo_url"],
		RepoName:          data["repo_name"],
		BaseBranch:        data["base_branch"],
		WorkBranch:        data["work_branch"],
		Status:            Status(data["status"]),
		JobCount:          jobCount,
		TotalLinesAdded:   linesAdded,
		TotalLinesRemoved: linesRemoved,
	}, nil
}

// getProviderInfo fetches provider details including decrypted token
func (e *PushExecutor) getProviderInfo(ctx context.Context, userID, providerID string) (*providerInfo, error) {
	key := rediskeys.GitProviderKey(userID, providerID)

	data, err := e.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("provider not found: %s", providerID)
	}

	encryptedToken, ok := data["token"]
	if !ok {
		return nil, fmt.Errorf("token not found for provider: %s", providerID)
	}

	token, err := e.decryptor.Decrypt(encryptedToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt token: %w", err)
	}

	return &providerInfo{
		Token: token,
		Type:  data["type"],
		URL:   data["url"],
	}, nil
}

// updateSessionStatus updates session status in Redis
func (e *PushExecutor) updateSessionStatus(ctx context.Context, sessionID string, status Status, fields map[string]interface{}) error {
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

// failSession marks a session as failed and returns to ready state
func (e *PushExecutor) failSession(ctx context.Context, sessionID string, err error) error {
	e.appendOutput(ctx, sessionID, "stderr", fmt.Sprintf("Error: %s", err.Error()))

	// Return to ready so user can retry
	e.updateSessionStatus(ctx, sessionID, StatusReady, map[string]interface{}{
		"mr_warning": err.Error(),
	})

	return err
}

// appendOutput adds output line to session output list
func (e *PushExecutor) appendOutput(ctx context.Context, sessionID, stream, line string) {
	key := rediskeys.WorkSessionOutputKey(sessionID)
	output := map[string]interface{}{
		"timestamp": time.Now().UnixMilli(),
		"line":      line,
		"stream":    stream,
	}
	data, _ := json.Marshal(output)
	e.rdb.RPush(ctx, key, string(data))
	e.rdb.Expire(ctx, key, 7*24*time.Hour)
}
