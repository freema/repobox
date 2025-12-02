package git

import (
	"fmt"
	"os/exec"
)

type Provider interface {
	Clone(repoURL, token, destPath string) error
	Push(repoPath, branch, token string) error
}

type Git struct{}

func New() *Git {
	return &Git{}
}

func (g *Git) Clone(repoURL, destPath string) error {
	cmd := exec.Command("git", "clone", repoURL, destPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git clone failed: %s: %w", output, err)
	}
	return nil
}

func (g *Git) CreateBranch(repoPath, branchName string) error {
	cmd := exec.Command("git", "-C", repoPath, "checkout", "-b", branchName)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git checkout -b failed: %s: %w", output, err)
	}
	return nil
}

func (g *Git) Commit(repoPath, message string) error {
	addCmd := exec.Command("git", "-C", repoPath, "add", "-A")
	if output, err := addCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git add failed: %s: %w", output, err)
	}

	commitCmd := exec.Command("git", "-C", repoPath, "commit", "-m", message)
	if output, err := commitCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git commit failed: %s: %w", output, err)
	}
	return nil
}

func (g *Git) Push(repoPath, remote, branch string) error {
	cmd := exec.Command("git", "-C", repoPath, "push", "-u", remote, branch)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git push failed: %s: %w", output, err)
	}
	return nil
}
