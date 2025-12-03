# Phase 07 - AI Agent Integration - Code Review

## Overview

Integration of Claude Code CLI (or compatible AI agent) with the Go runner. The agent executes prompts in cloned repositories, streams output in real-time to Redis, and handles timeouts, exit codes, and failure scenarios. Implements `tasks/SPEC.MD#Runner` (AI Agent) and aligns with Phase 08 for SSE streaming.

## Files Changed/Added

### New Files

| File | Purpose |
|------|---------|
| `apps/runner/internal/agent/agent.go` | Agent interface and types definition |
| `apps/runner/internal/agent/claude.go` | Claude Code CLI implementation |
| `apps/runner/internal/agent/claude_test.go` | Agent unit tests |

### Modified Files

| File | Changes |
|------|---------|
| `apps/runner/internal/config/config.go` | Added AI configuration fields |
| `apps/runner/internal/executor/executor.go` | Integrated agent execution |

## Implementation Details

### 7.1 Agent Interface

**Location:** `apps/runner/internal/agent/agent.go`

```go
type Agent interface {
    Execute(ctx context.Context, opts ExecuteOptions) error
}

type ExecuteOptions struct {
    WorkDir     string        // Cloned repository path
    Prompt      string        // User instruction
    Environment string        // Runtime environment
    JobID       string        // For logging
    Output      OutputWriter  // Streaming callback
}
```

- Clean interface allows future providers (Codex, custom LLMs)
- OutputWriter callback pattern enables real-time streaming
- Config struct separates agent settings from runner config

### 7.2 Claude CLI Wrapper

**Location:** `apps/runner/internal/agent/claude.go`

- Spawns `claude` CLI with args: `--print --output-format text -p <prompt>`
- Sets `ANTHROPIC_API_KEY` in process environment
- Concurrent stdout/stderr streaming via goroutines
- Uses `bufio.Scanner` with 1MB buffer for long lines
- Output line limit (default 10,000) prevents memory exhaustion

**Mock Mode:**
- Executes when `AI_ENABLED=false` or API key missing
- Creates `.repobox-mock.md` file to verify pipeline
- Useful for testing without AI costs

### 7.3 Output Streaming

**Pattern:** Callback-based streaming to Redis

```go
outputCallback := func(stream, line string) {
    e.appendOutput(jobCtx, j.ID, stream, line)
}
```

- Real-time: Each line pushed immediately via `RPUSH`
- Prefixed streams: `"stdout"` or `"stderr"` for UI styling
- JSON format: `{timestamp, line, stream}`
- 24-hour TTL on output lists

### 7.4 Error Handling

| Scenario | Detection | User Message |
|----------|-----------|--------------|
| Context timeout | `ctx.Err() == DeadlineExceeded` | "Agent execution timed out" |
| Context cancelled | `ctx.Err() == Canceled` | "Agent execution cancelled" |
| Non-zero exit | `exitErr.ExitCode()` | "Agent exited with code N" |
| CLI not found | `exec.Error` | "failed to start claude CLI" |
| Stream error | `scanner.Err()` | Logged, not fatal |

### 7.5 Configuration

**New Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_ENABLED` | `true` | Enable/disable AI agent |
| `AI_PROVIDER` | `claude` | Provider name (for future use) |
| `AI_CLI_PATH` | `claude` | Path to CLI executable |
| `ANTHROPIC_API_KEY` | (required) | API key for Claude |
| `AI_TIMEOUT` | `1800` | Agent timeout in seconds |
| `AI_MAX_OUTPUT_LINES` | `10000` | Max lines before truncation |

**Auto-disable:** If `AI_ENABLED=true` but `ANTHROPIC_API_KEY` is empty, mock mode is used.

## Test Coverage

```bash
$ go test ./internal/agent/... -v

=== RUN   TestClaudeAgent_ExecuteMock
--- PASS: TestClaudeAgent_ExecuteMock (0.00s)

=== RUN   TestClaudeAgent_ContextCancellation
--- PASS: TestClaudeAgent_ContextCancellation (0.00s)

=== RUN   TestTruncateString
--- PASS: TestTruncateString (0.00s)

=== RUN   TestConfig_Defaults
--- PASS: TestConfig_Defaults (0.00s)

=== RUN   TestWriteFile
--- PASS: TestWriteFile (0.00s)

PASS
ok      github.com/repobox/runner/internal/agent    0.004s
```

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Runner spawns agent with prompt | ✅ |
| Agent receives repo working directory | ✅ |
| Stdout/stderr streamed to Redis | ✅ |
| Timeout produces clear failure message | ✅ |
| Exit codes properly handled | ✅ |
| Mock mode for testing without AI | ✅ |
| Agent interface allows future providers | ✅ |

## Quality Checks

```
task build:runner - PASSED
├── go mod tidy: ✅
├── go build: ✅
└── go test: ✅ (agent, crypto, git packages)
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Executor                       │
│                                                 │
│  1. Clone repo         4. Commit & Push         │
│  2. Create branch      5. Update status         │
│  3. Execute agent ───────────────┐              │
└──────────────────────────────────│──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │         Agent               │
                    │                             │
                    │  ┌─────────────────────┐   │
                    │  │   Claude CLI        │   │
                    │  │   (subprocess)      │   │
                    │  └─────────┬───────────┘   │
                    │            │               │
                    │     stdout/stderr          │
                    │            │               │
                    │            ▼               │
                    │  ┌─────────────────────┐   │
                    │  │  Output Callback    │───┼──► Redis
                    │  │  (streaming)        │   │    job:{id}:output
                    │  └─────────────────────┘   │
                    └─────────────────────────────┘
```

## Integration Points

### Executor Flow (Updated)

```go
// After clone & branch creation:
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

// Then commit & push...
```

## Technical Notes

1. **Process Isolation:** Claude CLI runs as subprocess with separate environment
2. **Memory Safety:** Output line limit prevents OOM on verbose agents
3. **Context Propagation:** Job timeout inherited by agent via context
4. **Token Security:** API key passed via environment, not CLI args
5. **Graceful Degradation:** Mock mode when AI unavailable

## Dependencies

- Phase 06 (executor, git operations) ✅
- Phase 04 (Redis output streams) ✅

## Future Work

- Phase 08: SSE consumer for web UI real-time display
- Phase 09: MR/PR creation after agent completion
- Multiple AI providers (Codex, GPT-4, local LLMs)
- Per-job environment hooks (pre-run scripts)

---

*Reviewed: 2024-12-03*
