package git

import (
	"context"
	"fmt"
	"net/url"
	"os/exec"
	"strings"
)

// Git provides git operations with token handling
type Git struct {
	token       string // plaintext token for auth
	authorName  string
	authorEmail string
}

// Options for creating a Git helper
type Options struct {
	Token       string
	AuthorName  string
	AuthorEmail string
}

// New creates a new Git helper
func New() *Git {
	return &Git{}
}

// NewWithToken creates a Git helper with authentication token
func NewWithToken(token string) *Git {
	return &Git{token: token}
}

// NewWithOptions creates a Git helper with full options
func NewWithOptions(opts Options) *Git {
	return &Git{
		token:       opts.Token,
		authorName:  opts.AuthorName,
		authorEmail: opts.AuthorEmail,
	}
}

// Clone clones a repository. If token is set, embeds it in the URL.
func (g *Git) Clone(ctx context.Context, repoURL, destPath string) error {
	cloneURL := repoURL
	if g.token != "" {
		var err error
		cloneURL, err = embedToken(repoURL, g.token)
		if err != nil {
			return fmt.Errorf("failed to embed token: %w", err)
		}
	}

	cmd := exec.CommandContext(ctx, "git", "clone", cloneURL, destPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Mask token in error output
		safeOutput := maskTokenInString(string(output), g.token)
		return fmt.Errorf("git clone failed: %s: %w", safeOutput, err)
	}
	return nil
}

// CreateBranch creates and checks out a new branch
func (g *Git) CreateBranch(ctx context.Context, repoPath, branchName string) error {
	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "checkout", "-b", branchName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git checkout -b failed: %s: %w", output, err)
	}
	return nil
}

// Commit stages all changes and commits with the given message
func (g *Git) Commit(ctx context.Context, repoPath, message string) error {
	// Configure git author if set
	if g.authorName != "" {
		cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "config", "user.name", g.authorName)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("git config user.name failed: %s: %w", output, err)
		}
	}
	if g.authorEmail != "" {
		cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "config", "user.email", g.authorEmail)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("git config user.email failed: %s: %w", output, err)
		}
	}

	// Stage all changes
	addCmd := exec.CommandContext(ctx, "git", "-C", repoPath, "add", "-A")
	if output, err := addCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git add failed: %s: %w", output, err)
	}

	// Check if there are changes to commit
	diffCmd := exec.CommandContext(ctx, "git", "-C", repoPath, "diff", "--cached", "--quiet")
	if err := diffCmd.Run(); err == nil {
		// No changes to commit
		return nil
	}

	// Commit
	commitCmd := exec.CommandContext(ctx, "git", "-C", repoPath, "commit", "-m", message)
	if output, err := commitCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git commit failed: %s: %w", output, err)
	}
	return nil
}

// Push pushes the branch to remote. If token is set, reconfigures remote URL.
func (g *Git) Push(ctx context.Context, repoPath, branch string) error {
	// If we have a token, update the remote URL to include it
	if g.token != "" {
		// Get current remote URL
		getURLCmd := exec.CommandContext(ctx, "git", "-C", repoPath, "remote", "get-url", "origin")
		urlOutput, err := getURLCmd.Output()
		if err != nil {
			return fmt.Errorf("failed to get remote URL: %w", err)
		}

		remoteURL := strings.TrimSpace(string(urlOutput))
		authURL, err := embedToken(remoteURL, g.token)
		if err != nil {
			return fmt.Errorf("failed to embed token for push: %w", err)
		}

		// Set remote URL with token
		setURLCmd := exec.CommandContext(ctx, "git", "-C", repoPath, "remote", "set-url", "origin", authURL)
		if output, err := setURLCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to set remote URL: %s: %w", output, err)
		}

		// Reset URL after push (deferred)
		defer func() {
			resetCmd := exec.CommandContext(context.Background(), "git", "-C", repoPath, "remote", "set-url", "origin", remoteURL)
			_ = resetCmd.Run() // Best effort
		}()
	}

	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "push", "-u", "origin", branch)
	output, err := cmd.CombinedOutput()
	if err != nil {
		safeOutput := maskTokenInString(string(output), g.token)
		return fmt.Errorf("git push failed: %s: %w", safeOutput, err)
	}
	return nil
}

// GetDiffStats returns lines added and removed since branch creation
func (g *Git) GetDiffStats(ctx context.Context, repoPath, baseBranch string) (added, removed int, err error) {
	// Get diff stats: --numstat gives "added removed filename" per line
	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "diff", "--numstat", baseBranch+"...HEAD")
	output, err := cmd.Output()
	if err != nil {
		return 0, 0, fmt.Errorf("git diff failed: %w", err)
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			// Binary files show "-" instead of numbers
			if parts[0] != "-" {
				var a int
				fmt.Sscanf(parts[0], "%d", &a)
				added += a
			}
			if parts[1] != "-" {
				var r int
				fmt.Sscanf(parts[1], "%d", &r)
				removed += r
			}
		}
	}

	return added, removed, nil
}

// embedToken embeds the token into a git URL for authentication
// Supports: https://github.com/user/repo.git -> https://oauth2:TOKEN@github.com/user/repo.git
func embedToken(repoURL, token string) (string, error) {
	u, err := url.Parse(repoURL)
	if err != nil {
		return "", fmt.Errorf("invalid URL: %w", err)
	}

	if u.Scheme != "https" {
		return "", fmt.Errorf("only HTTPS URLs supported, got: %s", u.Scheme)
	}

	// Use oauth2 as username with token as password (works for GitHub/GitLab)
	u.User = url.UserPassword("oauth2", token)

	return u.String(), nil
}

// MaskToken masks a token for safe logging
// Shows only first 4 and last 4 characters: "ghp_xxxx****xxxx"
func MaskToken(token string) string {
	if len(token) <= 12 {
		return "****"
	}
	return token[:4] + "****" + token[len(token)-4:]
}

// maskTokenInString replaces all occurrences of token in a string
func maskTokenInString(s, token string) string {
	if token == "" {
		return s
	}
	return strings.ReplaceAll(s, token, MaskToken(token))
}
