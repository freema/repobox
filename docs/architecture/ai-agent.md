# AI Agent Architecture

## Overview

The AI Agent is a core component of Repobox that executes code modifications based on user prompts. It runs as a subprocess spawned by the Go runner, operating within cloned repositories.

## Design Principles

1. **Provider Agnostic**: Abstract interface allows multiple AI providers
2. **Process Isolation**: Agent runs as subprocess with separate environment
3. **Real-time Streaming**: Output pushed to Redis line-by-line
4. **Graceful Degradation**: Mock mode when AI unavailable
5. **Resource Limits**: Output truncation, timeouts prevent runaway processes

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Runner                                  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Executor                             │  │
│  │                                                          │  │
│  │   1. Clone repo      3. Execute Agent     5. Push        │  │
│  │   2. Create branch   4. Commit changes                   │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Agent                                │  │
│  │                                                          │  │
│  │   ┌─────────────────────────────────────────────────┐   │  │
│  │   │              Agent Interface                     │   │  │
│  │   │                                                  │   │  │
│  │   │  Execute(ctx, opts) error                        │   │  │
│  │   └─────────────────────────────────────────────────┘   │  │
│  │                         │                                │  │
│  │            ┌────────────┴────────────┐                  │  │
│  │            │                         │                  │  │
│  │            ▼                         ▼                  │  │
│  │   ┌─────────────────┐       ┌─────────────────┐        │  │
│  │   │  ClaudeAgent    │       │   MockAgent     │        │  │
│  │   │                 │       │                 │        │  │
│  │   │  claude CLI     │       │  Creates test   │        │  │
│  │   │  subprocess     │       │  file only      │        │  │
│  │   └────────┬────────┘       └─────────────────┘        │  │
│  │            │                                            │  │
│  │            ▼                                            │  │
│  │   ┌─────────────────────────────────────────────────┐   │  │
│  │   │           Output Streaming                       │   │  │
│  │   │                                                  │   │  │
│  │   │  stdout ──┐                                      │   │  │
│  │   │           ├──▶ OutputWriter callback ──▶ Redis   │   │  │
│  │   │  stderr ──┘                                      │   │  │
│  │   └─────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Agent Interface

```go
// Agent defines the interface for AI code agents
type Agent interface {
    Execute(ctx context.Context, opts ExecuteOptions) error
}

// ExecuteOptions contains all options for agent execution
type ExecuteOptions struct {
    WorkDir     string        // Path to cloned repository
    Prompt      string        // User's instruction
    Environment string        // Runtime environment (default, php, python)
    JobID       string        // For logging and identification
    Output      OutputWriter  // Callback for streaming output
}

// OutputWriter is a callback for streaming agent output
type OutputWriter func(stream, line string)
```

## Claude Code Integration

### CLI Invocation

```bash
claude --print --output-format text -p "<prompt>"
```

**Arguments:**
- `--print`: Output to stdout (non-interactive mode)
- `--output-format text`: Plain text output (vs json/stream-json)
- `-p`: Provide the prompt

### Environment

The agent runs with:
- Working directory set to cloned repo
- `ANTHROPIC_API_KEY` in environment

### Process Management

```go
cmd := exec.CommandContext(ctx, "claude", args...)
cmd.Dir = workDir
cmd.Env = append(cmd.Environ(), "ANTHROPIC_API_KEY="+apiKey)
```

## Output Streaming

### Flow

1. Agent spawns subprocess with stdout/stderr pipes
2. Goroutines scan each pipe line-by-line
3. Each line triggers OutputWriter callback
4. Callback pushes to Redis via `RPUSH`

### Redis Storage

```
Key: job:{jobId}:output
Type: List
TTL: 24 hours

Entry format (JSON):
{
  "timestamp": 1701561234567,
  "line": "Reading package.json...",
  "stream": "stdout"
}
```

### Buffer Configuration

- Scanner buffer: 64KB initial, 1MB max per line
- Output limit: 10,000 lines (configurable)
- Truncation message after limit reached

## Error Handling

### Timeout

```go
if ctx.Err() == context.DeadlineExceeded {
    opts.Output("stderr", "Agent execution timed out")
    return fmt.Errorf("agent execution timed out")
}
```

### Exit Codes

```go
if exitErr, ok := waitErr.(*exec.ExitError); ok {
    exitCode := exitErr.ExitCode()
    opts.Output("stderr", fmt.Sprintf("Agent exited with code %d", exitCode))
    return fmt.Errorf("agent exited with code %d", exitCode)
}
```

### Error Categories

| Error Type | Detection | User Message |
|------------|-----------|--------------|
| Timeout | `ctx.Err() == DeadlineExceeded` | "Agent execution timed out" |
| Cancelled | `ctx.Err() == Canceled` | "Agent execution cancelled" |
| Exit code ≠ 0 | `ExitError.ExitCode()` | "Agent exited with code N" |
| CLI not found | `exec.Error` | "failed to start claude CLI" |
| Stream error | `scanner.Err()` | Logged, non-fatal |

## Mock Mode

Activated when:
- `AI_ENABLED=false`
- `ANTHROPIC_API_KEY` is empty

### Behavior

1. Logs "AI agent is disabled - running in mock mode"
2. Creates `.repobox-mock.md` with job details
3. Returns success (allows testing full pipeline)

### Mock File Content

```markdown
# Repobox Mock Execution

This file was created by Repobox in mock mode.

## Job Details
- Job ID: abc123
- Environment: default

## Prompt
<user's prompt here>

---
*Generated by Repobox mock agent*
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_ENABLED` | `true` | Enable AI agent |
| `AI_PROVIDER` | `claude` | Provider name |
| `AI_CLI_PATH` | `claude` | CLI executable path |
| `ANTHROPIC_API_KEY` | - | Claude API key |
| `AI_TIMEOUT` | `1800` | Timeout (seconds) |
| `AI_MAX_OUTPUT_LINES` | `10000` | Output line limit |

## Security

### API Key Protection

- Passed via environment variable, not CLI args
- Never logged or included in output
- Not accessible to user code in repo

### Process Isolation

- Runs in separate subprocess
- Inherits job timeout from context
- Killed on timeout/cancellation

### Resource Limits

- Output truncated at configurable limit
- Prevents memory exhaustion from verbose output
- Timeout prevents runaway processes

## Future Providers

The interface supports adding new providers:

```go
// Example: OpenAI Codex
type CodexAgent struct {
    cfg    *Config
    logger *slog.Logger
}

func (a *CodexAgent) Execute(ctx context.Context, opts ExecuteOptions) error {
    // Implement Codex-specific logic
}
```

### Planned Providers

| Provider | Status | Notes |
|----------|--------|-------|
| Claude Code | ✅ Implemented | Primary provider |
| Mock | ✅ Implemented | Testing only |
| OpenAI Codex | 🔜 Planned | Future |
| Local LLM | 🔜 Planned | Ollama, etc. |

## Testing

### Unit Tests

```bash
go test ./internal/agent/... -v
```

### Test Cases

1. **Mock execution**: Verifies mock mode creates file
2. **Context cancellation**: Verifies timeout handling
3. **Truncation**: Verifies output limits
4. **File writing**: Verifies helper functions

### Integration Testing

Use mock mode to test full pipeline:

```bash
AI_ENABLED=false task dev:runner
```

## Troubleshooting

### Agent Not Found

```
Error: failed to start claude CLI: exec: "claude": executable file not found
```

**Solution:** Install Claude Code CLI or set `AI_CLI_PATH` to correct path.

### API Key Invalid

```
Error: agent exited with code 1
```

**Solution:** Verify `ANTHROPIC_API_KEY` is valid.

### Timeout Issues

```
Error: Agent execution timed out
```

**Solution:** Increase `AI_TIMEOUT` or simplify prompt.

### Output Truncated

```
... output truncated after 10000 lines
```

**Solution:** Increase `AI_MAX_OUTPUT_LINES` if needed.
