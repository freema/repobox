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
	rediskeys "github.com/repobox/runner/internal/redis"
)

// InitExecutor handles work session initialization (clone repo, create branch)
type InitExecutor struct {
	rdb       *redis.Client
	cfg       *config.Config
	decryptor *crypto.Decryptor
	logger    *slog.Logger
}

// NewInitExecutor creates a new init executor
func NewInitExecutor(rdb *redis.Client, cfg *config.Config, logger *slog.Logger) (*InitExecutor, error) {
	decryptor, err := crypto.NewDecryptor(cfg.EncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create decryptor: %w", err)
	}

	return &InitExecutor{
		rdb:       rdb,
		cfg:       cfg,
		decryptor: decryptor,
		logger:    logger.With("component", "session-init-executor"),
	}, nil
}

// Execute initializes a work session (clone repo, create branch)
func (e *InitExecutor) Execute(ctx context.Context, msg *InitMessage) error {
	logger := e.logger.With(
		"session_id", msg.SessionID,
		"user_id", msg.UserID,
		"repo", msg.RepoName,
	)

	logger.Info("initializing work session")

	// Create session workdir
	workDir := e.getSessionWorkDir(msg.SessionID)
	if err := os.MkdirAll(workDir, 0755); err != nil {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("failed to create workdir: %w", err))
	}

	// Get provider info
	provider, err := e.getProviderInfo(ctx, msg.UserID, msg.ProviderID)
	if err != nil {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("failed to get provider: %w", err))
	}

	// Check if repo already cloned (idempotency)
	repoPath := filepath.Join(workDir, "repo")
	gitDir := filepath.Join(repoPath, ".git")
	if _, err := os.Stat(gitDir); err == nil {
		logger.Info("repository already cloned, skipping clone")
		e.appendOutput(ctx, msg.SessionID, "stdout", "Repository already initialized.")

		// Update session status to ready (in case previous run failed after clone)
		if err := e.updateSessionStatus(ctx, msg.SessionID, StatusReady, nil); err != nil {
			logger.Error("failed to update session status", "error", err)
		}
		return nil
	}

	e.appendOutput(ctx, msg.SessionID, "stdout", "Cloning repository...")

	// Clone repository
	g := git.NewWithOptions(git.Options{
		Token:       provider.Token,
		AuthorName:  e.cfg.GitAuthorName,
		AuthorEmail: e.cfg.GitAuthorEmail,
	})

	if err := g.Clone(ctx, msg.RepoURL, repoPath); err != nil {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("clone failed: %w", err))
	}

	e.appendOutput(ctx, msg.SessionID, "stdout", "Clone completed.")

	// Create work branch
	branchName := fmt.Sprintf("repobox/%s", msg.SessionID[:8])
	e.appendOutput(ctx, msg.SessionID, "stdout", fmt.Sprintf("Creating branch %s...", branchName))

	if err := g.CreateBranch(ctx, repoPath, branchName); err != nil {
		return e.failSession(ctx, msg.SessionID, fmt.Errorf("create branch failed: %w", err))
	}

	e.appendOutput(ctx, msg.SessionID, "stdout", "Work session ready. You can now submit prompts.")

	// Update session status to ready
	if err := e.updateSessionStatus(ctx, msg.SessionID, StatusReady, nil); err != nil {
		logger.Error("failed to update session status", "error", err)
	}

	logger.Info("work session initialized successfully", "branch", branchName)

	return nil
}

// getSessionWorkDir returns the workdir path for a session
func (e *InitExecutor) getSessionWorkDir(sessionID string) string {
	return filepath.Join(e.cfg.TempDir, "sessions", sessionID)
}

// providerInfo holds provider data
type providerInfo struct {
	Token string
	Type  string
	URL   string
}

// getProviderInfo fetches provider details including decrypted token
func (e *InitExecutor) getProviderInfo(ctx context.Context, userID, providerID string) (*providerInfo, error) {
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
func (e *InitExecutor) updateSessionStatus(ctx context.Context, sessionID string, status Status, fields map[string]interface{}) error {
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

// failSession marks a session as failed
func (e *InitExecutor) failSession(ctx context.Context, sessionID string, err error) error {
	e.appendOutput(ctx, sessionID, "stderr", fmt.Sprintf("Error: %s", err.Error()))

	e.updateSessionStatus(ctx, sessionID, StatusFailed, map[string]interface{}{
		"error_message": err.Error(),
	})

	return err
}

// appendOutput adds output line to session output list
func (e *InitExecutor) appendOutput(ctx context.Context, sessionID, stream, line string) {
	key := rediskeys.WorkSessionOutputKey(sessionID)
	output := map[string]interface{}{
		"timestamp": time.Now().UnixMilli(),
		"line":      line,
		"stream":    stream,
	}
	data, _ := json.Marshal(output)
	e.rdb.RPush(ctx, key, string(data))
	e.rdb.Expire(ctx, key, 7*24*time.Hour) // 7 days TTL
}
