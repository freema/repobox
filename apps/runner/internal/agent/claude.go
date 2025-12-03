package agent

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
	"sync"
)

// ClaudeAgent implements the Agent interface using Claude Code CLI
type ClaudeAgent struct {
	cfg    *Config
	logger *slog.Logger
}

// NewClaudeAgent creates a new Claude Code CLI agent
func NewClaudeAgent(cfg *Config, logger *slog.Logger) *ClaudeAgent {
	return &ClaudeAgent{
		cfg:    cfg,
		logger: logger,
	}
}

// Execute runs Claude Code CLI with the given prompt
func (a *ClaudeAgent) Execute(ctx context.Context, opts ExecuteOptions) error {
	if !a.cfg.Enabled {
		return a.executeMock(ctx, opts)
	}

	logger := a.logger.With("job_id", opts.JobID, "work_dir", opts.WorkDir)
	logger.Info("executing claude agent")

	// Build command
	cliPath := a.cfg.CLIPath
	if cliPath == "" {
		cliPath = "claude" // Default to PATH lookup
	}

	// Claude Code CLI arguments:
	// --print: Output to stdout instead of interactive mode
	// --output-format text: Plain text output (vs json/stream-json)
	// -p: Provide the prompt
	args := []string{
		"--print",
		"--output-format", "text",
		"-p", opts.Prompt,
	}

	cmd := exec.CommandContext(ctx, cliPath, args...)
	cmd.Dir = opts.WorkDir

	// Set up environment
	cmd.Env = append(cmd.Environ(),
		fmt.Sprintf("ANTHROPIC_API_KEY=%s", a.cfg.APIKey),
	)

	// Get stdout and stderr pipes
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the command
	logger.Info("starting claude CLI", "cli_path", cliPath, "args", args)
	opts.Output("stdout", fmt.Sprintf("Starting AI agent (claude %s)...", strings.Join(args[:3], " ")))

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start claude CLI: %w", err)
	}

	// Stream output concurrently
	var wg sync.WaitGroup
	var streamErr error
	var streamErrMu sync.Mutex

	// Stream stdout
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := a.streamOutput(ctx, stdout, "stdout", opts.Output); err != nil {
			streamErrMu.Lock()
			if streamErr == nil {
				streamErr = fmt.Errorf("stdout stream error: %w", err)
			}
			streamErrMu.Unlock()
		}
	}()

	// Stream stderr
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := a.streamOutput(ctx, stderr, "stderr", opts.Output); err != nil {
			streamErrMu.Lock()
			if streamErr == nil {
				streamErr = fmt.Errorf("stderr stream error: %w", err)
			}
			streamErrMu.Unlock()
		}
	}()

	// Wait for streams to complete
	wg.Wait()

	// Wait for command to finish
	waitErr := cmd.Wait()

	// Check context for timeout/cancellation
	if ctx.Err() != nil {
		if ctx.Err() == context.DeadlineExceeded {
			opts.Output("stderr", "Agent execution timed out")
			return fmt.Errorf("agent execution timed out")
		}
		if ctx.Err() == context.Canceled {
			opts.Output("stderr", "Agent execution cancelled")
			return fmt.Errorf("agent execution cancelled")
		}
		return ctx.Err()
	}

	// Check stream errors
	if streamErr != nil {
		logger.Warn("stream error during execution", "error", streamErr)
	}

	// Check exit code
	if waitErr != nil {
		if exitErr, ok := waitErr.(*exec.ExitError); ok {
			exitCode := exitErr.ExitCode()
			logger.Error("claude CLI exited with error", "exit_code", exitCode)
			opts.Output("stderr", fmt.Sprintf("Agent exited with code %d", exitCode))
			return fmt.Errorf("agent exited with code %d: %w", exitCode, waitErr)
		}
		return fmt.Errorf("agent execution failed: %w", waitErr)
	}

	opts.Output("stdout", "AI agent completed successfully")
	logger.Info("claude agent completed successfully")
	return nil
}

// streamOutput reads from reader line by line and calls output callback
func (a *ClaudeAgent) streamOutput(ctx context.Context, reader interface{ Read([]byte) (int, error) }, stream string, output OutputWriter) error {
	// Use larger buffer for potentially long lines
	scanner := bufio.NewScanner(reader)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024) // 1MB max line length

	lineCount := 0
	maxLines := a.cfg.MaxOutputLines
	if maxLines == 0 {
		maxLines = 10000 // Default limit
	}

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line := scanner.Text()
		lineCount++

		if lineCount > maxLines {
			if lineCount == maxLines+1 {
				output(stream, fmt.Sprintf("... output truncated after %d lines", maxLines))
			}
			continue
		}

		output(stream, line)
	}

	return scanner.Err()
}

// executeMock runs a mock agent for testing when AI is disabled
func (a *ClaudeAgent) executeMock(ctx context.Context, opts ExecuteOptions) error {
	logger := a.logger.With("job_id", opts.JobID)
	logger.Info("executing mock agent (AI disabled)")

	opts.Output("stdout", "AI agent is disabled - running in mock mode")
	opts.Output("stdout", fmt.Sprintf("Would execute prompt: %s", truncateString(opts.Prompt, 100)))
	opts.Output("stdout", fmt.Sprintf("Working directory: %s", opts.WorkDir))
	opts.Output("stdout", fmt.Sprintf("Environment: %s", opts.Environment))

	// Create a mock file to verify the flow works
	// This is useful for testing the full pipeline without AI
	mockContent := fmt.Sprintf(`# Repobox Mock Execution

This file was created by Repobox in mock mode (AI agent disabled).

## Job Details
- Job ID: %s
- Environment: %s

## Prompt
%s

---
*Generated by Repobox mock agent*
`, opts.JobID, opts.Environment, opts.Prompt)

	// Write mock file
	mockFile := opts.WorkDir + "/.repobox-mock.md"
	if err := writeFile(mockFile, mockContent); err != nil {
		opts.Output("stderr", fmt.Sprintf("Failed to create mock file: %s", err))
		return fmt.Errorf("mock agent failed: %w", err)
	}

	opts.Output("stdout", "Mock agent completed - created .repobox-mock.md")
	return nil
}

// truncateString truncates a string to max length with ellipsis
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// writeFile is a helper to write content to a file
func writeFile(path, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}
