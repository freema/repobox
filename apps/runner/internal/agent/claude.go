package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
	"sync"
)

// StreamMessage represents a message from Claude CLI stream-json output
type StreamMessage struct {
	Type     string          `json:"type"`    // "system", "assistant", "user", "result"
	Subtype  string          `json:"subtype"` // "init", "success", etc.
	Message  *MessageContent `json:"message"`
	Result   string          `json:"result"`
	SessionID string         `json:"session_id"`
}

// MessageContent represents the content of an assistant/user message
type MessageContent struct {
	Role    string         `json:"role"`
	Content []ContentBlock `json:"content"`
}

// ContentBlock represents a single block in a message
type ContentBlock struct {
	Type      string      `json:"type"`        // "text", "tool_use", "tool_result"
	Text      string      `json:"text"`        // for text blocks
	ID        string      `json:"id"`          // for tool_use
	Name      string      `json:"name"`        // for tool_use (Read, Edit, Bash, etc.)
	Input     interface{} `json:"input"`       // for tool_use
	ToolUseID string      `json:"tool_use_id"` // for tool_result
	Content   interface{} `json:"content"`     // for tool_result (can be string or array)
}

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
	// --output-format stream-json: Streaming JSON output with tool calls
	// --verbose: Required for stream-json with --print
	// -p: Provide the prompt
	args := []string{
		"--print",
		"--output-format", "stream-json",
		"--verbose",
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
	opts.Output("stdout", SourceRunner, fmt.Sprintf("Starting AI agent (claude %s)...", strings.Join(args[:3], " ")))

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
			opts.Output("stderr", SourceRunner, "Agent execution timed out")
			return fmt.Errorf("agent execution timed out")
		}
		if ctx.Err() == context.Canceled {
			opts.Output("stderr", SourceRunner, "Agent execution cancelled")
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
			opts.Output("stderr", SourceRunner, fmt.Sprintf("Agent exited with code %d", exitCode))
			return fmt.Errorf("agent exited with code %d: %w", exitCode, waitErr)
		}
		return fmt.Errorf("agent execution failed: %w", waitErr)
	}

	opts.Output("stdout", SourceRunner, "AI agent completed successfully")
	logger.Info("claude agent completed successfully")
	return nil
}

// streamOutput reads from reader line by line and calls output callback
// For stream-json format, it parses JSON and extracts human-readable output
func (a *ClaudeAgent) streamOutput(ctx context.Context, reader interface{ Read([]byte) (int, error) }, stream string, output OutputWriter) error {
	// Use larger buffer for potentially long lines (JSON can be large)
	scanner := bufio.NewScanner(reader)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 2*1024*1024) // 2MB max line length for JSON

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
				output(stream, SourceRunner, fmt.Sprintf("... output truncated after %d lines", maxLines))
			}
			continue
		}

		// Try to parse as JSON (stream-json format)
		var msg StreamMessage
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			// Not valid JSON, output as raw line (fallback)
			output(stream, SourceClaude, line)
			continue
		}

		// Process based on message type
		a.processStreamMessage(&msg, stream, output)
	}

	return scanner.Err()
}

// processStreamMessage extracts and outputs human-readable content from stream-json messages
func (a *ClaudeAgent) processStreamMessage(msg *StreamMessage, stream string, output OutputWriter) {
	switch msg.Type {
	case "system":
		// System messages (init, etc.) - skip or log minimally
		if msg.Subtype == "init" && msg.SessionID != "" {
			output(stream, SourceRunner, fmt.Sprintf("Claude session: %s", msg.SessionID))
		}

	case "assistant":
		if msg.Message == nil || len(msg.Message.Content) == 0 {
			return
		}

		for _, block := range msg.Message.Content {
			switch block.Type {
			case "text":
				// Text response from Claude
				if block.Text != "" {
					output(stream, SourceClaude, block.Text)
				}

			case "tool_use":
				// Tool call - format as readable line
				target := a.getToolTarget(block.Name, block.Input)
				output(stream, SourceClaude, fmt.Sprintf("%s %s", block.Name, target))

			case "tool_result":
				// Tool results - summarize if too long
				content := a.formatToolResult(block.Content)
				if content != "" {
					// Only output short summaries, full results can be very long
					if len(content) > 200 {
						content = content[:200] + "..."
					}
					output(stream, SourceClaude, fmt.Sprintf("└─ %s", content))
				}
			}
		}

	case "result":
		// Final result - include stats if available
		if msg.Subtype == "success" {
			output(stream, SourceRunner, "Claude completed successfully")
		} else if msg.Subtype == "error" {
			output(stream, SourceRunner, fmt.Sprintf("Claude error: %s", msg.Result))
		}
	}
}

// getToolTarget extracts the main target/argument from tool input
func (a *ClaudeAgent) getToolTarget(toolName string, input interface{}) string {
	if input == nil {
		return ""
	}

	inputMap, ok := input.(map[string]interface{})
	if !ok {
		return ""
	}

	switch toolName {
	case "Read", "Write", "Edit":
		if path, ok := inputMap["file_path"].(string); ok {
			return path
		}
	case "Bash":
		if cmd, ok := inputMap["command"].(string); ok {
			// Truncate long commands
			if len(cmd) > 80 {
				return cmd[:80] + "..."
			}
			return cmd
		}
	case "Grep":
		if pattern, ok := inputMap["pattern"].(string); ok {
			if path, ok := inputMap["path"].(string); ok {
				return fmt.Sprintf("\"%s\" in %s", pattern, path)
			}
			return fmt.Sprintf("\"%s\"", pattern)
		}
	case "Glob":
		if pattern, ok := inputMap["pattern"].(string); ok {
			return pattern
		}
	case "Task":
		if prompt, ok := inputMap["prompt"].(string); ok {
			if len(prompt) > 60 {
				return prompt[:60] + "..."
			}
			return prompt
		}
	}

	return ""
}

// formatToolResult converts tool result content to string
func (a *ClaudeAgent) formatToolResult(content interface{}) string {
	if content == nil {
		return ""
	}

	switch v := content.(type) {
	case string:
		return v
	case []interface{}:
		// Array of content blocks
		var parts []string
		for _, item := range v {
			if m, ok := item.(map[string]interface{}); ok {
				if text, ok := m["text"].(string); ok {
					parts = append(parts, text)
				}
			}
		}
		return strings.Join(parts, " ")
	default:
		return fmt.Sprintf("%v", content)
	}
}

// executeMock runs a mock agent for testing when AI is disabled
func (a *ClaudeAgent) executeMock(ctx context.Context, opts ExecuteOptions) error {
	logger := a.logger.With("job_id", opts.JobID)
	logger.Info("executing mock agent (AI disabled)")

	opts.Output("stdout", SourceRunner, "AI agent is disabled - running in mock mode")
	opts.Output("stdout", SourceRunner, fmt.Sprintf("Would execute prompt: %s", truncateString(opts.Prompt, 100)))
	opts.Output("stdout", SourceRunner, fmt.Sprintf("Working directory: %s", opts.WorkDir))
	opts.Output("stdout", SourceRunner, fmt.Sprintf("Environment: %s", opts.Environment))

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
		opts.Output("stderr", SourceRunner, fmt.Sprintf("Failed to create mock file: %s", err))
		return fmt.Errorf("mock agent failed: %w", err)
	}

	opts.Output("stdout", SourceRunner, "Mock agent completed - created .repobox-mock.md")
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
