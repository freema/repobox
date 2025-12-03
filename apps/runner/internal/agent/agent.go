package agent

import (
	"context"
)

// OutputWriter is a callback for streaming agent output
type OutputWriter func(stream, line string)

// Agent defines the interface for AI code agents
type Agent interface {
	// Execute runs the agent with the given prompt in the working directory.
	// Output is streamed via the OutputWriter callback.
	// Returns error if execution fails, times out, or exits with non-zero code.
	Execute(ctx context.Context, opts ExecuteOptions) error
}

// ExecuteOptions contains all options for agent execution
type ExecuteOptions struct {
	// WorkDir is the path to the cloned repository
	WorkDir string

	// Prompt is the user's instruction for the AI agent
	Prompt string

	// Environment is the runtime environment (e.g., "default", "php", "python")
	Environment string

	// JobID is used for logging and identification
	JobID string

	// Output is the callback for streaming stdout/stderr lines
	Output OutputWriter
}

// Result contains the outcome of agent execution
type Result struct {
	// ExitCode is the process exit code (0 = success)
	ExitCode int

	// Error contains any error message if execution failed
	Error string
}

// Config holds agent-specific configuration
type Config struct {
	// Enabled indicates whether AI agent is active
	Enabled bool

	// Provider is the AI provider name (e.g., "claude", "mock")
	Provider string

	// CLIPath is the path to the CLI executable
	CLIPath string

	// APIKey is the API key for the AI provider
	APIKey string

	// Timeout is the maximum execution time for the agent
	Timeout int

	// MaxOutputLines limits output to prevent memory issues
	MaxOutputLines int
}
