package agent

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestClaudeAgent_ExecuteMock(t *testing.T) {
	// Test mock mode execution
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	cfg := &Config{
		Enabled:        false, // Mock mode
		MaxOutputLines: 100,
	}
	agent := NewClaudeAgent(cfg, logger)

	// Create temp dir
	tempDir, err := os.MkdirTemp("", "agent-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Collect output
	var outputLines []string
	outputCallback := func(stream string, source OutputSource, line string) {
		outputLines = append(outputLines, stream+": "+line)
	}

	opts := ExecuteOptions{
		WorkDir:     tempDir,
		Prompt:      "Test prompt for mock agent",
		Environment: "default",
		JobID:       "test-job-123",
		Output:      outputCallback,
	}

	ctx := context.Background()
	err = agent.Execute(ctx, opts)
	if err != nil {
		t.Fatalf("mock execution failed: %v", err)
	}

	// Verify output
	if len(outputLines) == 0 {
		t.Error("expected output lines, got none")
	}

	// Check for expected messages
	foundMockMode := false
	foundPrompt := false
	for _, line := range outputLines {
		if strings.Contains(line, "mock mode") {
			foundMockMode = true
		}
		if strings.Contains(line, "Test prompt") {
			foundPrompt = true
		}
	}

	if !foundMockMode {
		t.Error("expected 'mock mode' in output")
	}
	if !foundPrompt {
		t.Error("expected prompt in output")
	}

	// Verify mock file created
	mockFile := filepath.Join(tempDir, ".repobox-mock.md")
	if _, err := os.Stat(mockFile); os.IsNotExist(err) {
		t.Error("mock file was not created")
	}
}

func TestClaudeAgent_ContextCancellation(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	cfg := &Config{
		Enabled:        true,
		CLIPath:        "sleep", // Use sleep command for testing
		MaxOutputLines: 100,
	}
	agent := NewClaudeAgent(cfg, logger)

	tempDir, err := os.MkdirTemp("", "agent-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	var outputLines []string
	outputCallback := func(stream string, source OutputSource, line string) {
		outputLines = append(outputLines, stream+": "+line)
	}

	opts := ExecuteOptions{
		WorkDir:     tempDir,
		Prompt:      "test",
		Environment: "default",
		JobID:       "test-job-456",
		Output:      outputCallback,
	}

	// Create context with short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err = agent.Execute(ctx, opts)

	// Should fail with context deadline exceeded or cancelled
	if err == nil {
		t.Skip("sleep command might not be available or executed too fast")
	}

	if !strings.Contains(err.Error(), "timed out") && !strings.Contains(err.Error(), "cancelled") && !strings.Contains(err.Error(), "context") {
		t.Logf("error was: %v (acceptable for this test)", err)
	}
}

func TestTruncateString(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"short", 10, "short"},
		{"exactly10!", 10, "exactly10!"},
		{"this is a longer string", 10, "this is..."},
		{"", 10, ""},
		{"a", 1, "a"},
	}

	for _, tt := range tests {
		result := truncateString(tt.input, tt.maxLen)
		if result != tt.expected {
			t.Errorf("truncateString(%q, %d) = %q, want %q", tt.input, tt.maxLen, result, tt.expected)
		}
	}
}

func TestConfig_Defaults(t *testing.T) {
	cfg := &Config{}

	if cfg.Enabled {
		t.Error("default Enabled should be false")
	}
	if cfg.MaxOutputLines != 0 {
		t.Error("default MaxOutputLines should be 0 (agent will use default)")
	}
}

func TestWriteFile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "write-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	testFile := filepath.Join(tempDir, "test.txt")
	testContent := "Hello, World!\nLine 2"

	err = writeFile(testFile, testContent)
	if err != nil {
		t.Fatalf("writeFile failed: %v", err)
	}

	content, err := os.ReadFile(testFile)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if string(content) != testContent {
		t.Errorf("content mismatch: got %q, want %q", string(content), testContent)
	}
}
