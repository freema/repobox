# Go Runner Architecture

## Overview

The Runner is a Go service that processes coding jobs from a Redis Stream queue. It handles git operations, orchestrates AI agents, and reports status back to the web app.

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        GO RUNNER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Consumer   │────▶│  Job Channel │────▶│ Worker Pool  │    │
│  │              │     │              │     │   (N jobs)   │    │
│  │ XREADGROUP   │     │  Buffered    │     │              │    │
│  │ User limits  │     │              │     │  Executor    │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                                         │            │
│         │              ┌──────────────┐           │            │
│         └─────────────▶│    Redis     │◀──────────┘            │
│                        │              │                        │
│                        │ - Job status │                        │
│                        │ - User limits│                        │
│                        │ - Output     │                        │
│                        └──────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Web App** creates job in Redis:
   - `HSET job:{id}` - job metadata
   - `XADD jobs:stream` - queue message

2. **Consumer** reads from stream:
   - `XREADGROUP` with consumer group `jobs:stream:runners`
   - Checks user limit via `GET runner:user:{userId}:running`
   - Increments counter, dispatches to worker

3. **Worker** executes job:
   - Updates status to `running`
   - Fetches token from `git_provider:{userId}:{providerId}`
   - Decrypts token (AES-256-GCM)
   - Clone → Branch → **AI Agent** → Commit → Push
   - Updates status to `success`/`failed`
   - Streams output to `job:{id}:output` in real-time

4. **Completion**:
   - `XACK` stream message
   - `DECR runner:user:{userId}:running`

## Redis Keys

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `jobs:stream` | Stream | Job queue |
| `jobs:stream:runners` | Consumer Group | Runner consumers |
| `job:{id}` | Hash | Job metadata |
| `job:{id}:output` | List | Output lines (JSON) |
| `git_provider:{userId}:{providerId}` | Hash | Provider with encrypted token |
| `runner:user:{userId}:running` | String | Running job counter |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_JOBS` | 10 | Total workers |
| `MAX_JOBS_PER_USER` | 3 | Per-user limit |
| `JOB_TIMEOUT` | 3600s | Max job duration |

## Security

- **Token Encryption**: AES-256-GCM, format `iv:authTag:ciphertext`
- **Token Masking**: `ghp_****xxxx` in all logs
- **URL Embedding**: `https://oauth2:TOKEN@host/repo.git`
- **Cleanup**: Temp directories removed after job

## Scaling

### Horizontal (Multiple Runners)
- Each runner joins same consumer group
- Redis distributes jobs automatically
- No coordination needed

### Vertical (More Workers)
- Increase `MAX_CONCURRENT_JOBS`
- Consider memory for git clones (~100MB each)
- CPU bound by AI agent calls

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Redis disconnect | Reconnect with backoff |
| Job timeout | Kill, mark failed, cleanup |
| Git clone fail | Mark failed, log masked error |
| Worker panic | Recover, mark failed, continue |
| Shutdown signal | Finish in-flight, decrement counters |
| AI agent timeout | Kill process, mark failed |
| AI agent exit code ≠ 0 | Mark failed with exit code |

## AI Agent Integration

The runner spawns AI agents as subprocesses to execute code changes.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Executor                               │
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │  Clone  │───▶│ Branch  │───▶│  Agent  │───▶│  Push   │  │
│  └─────────┘    └─────────┘    └────┬────┘    └─────────┘  │
│                                     │                       │
└─────────────────────────────────────│───────────────────────┘
                                      │
                       ┌──────────────▼──────────────┐
                       │        AI Agent             │
                       │                             │
                       │  ┌───────────────────────┐  │
                       │  │   Claude Code CLI     │  │
                       │  │   (subprocess)        │  │
                       │  └───────────┬───────────┘  │
                       │              │              │
                       │       stdout/stderr        │
                       │              │              │
                       │              ▼              │
                       │  ┌───────────────────────┐  │
                       │  │   Output Streaming    │──┼──▶ Redis
                       │  │   (real-time)         │  │
                       │  └───────────────────────┘  │
                       └─────────────────────────────┘
```

### Agent Interface

```go
type Agent interface {
    Execute(ctx context.Context, opts ExecuteOptions) error
}

type ExecuteOptions struct {
    WorkDir     string        // Cloned repo path
    Prompt      string        // User instruction
    Environment string        // Runtime environment
    JobID       string        // For logging
    Output      OutputWriter  // Streaming callback
}
```

### Supported Providers

| Provider | CLI Command | Status |
|----------|-------------|--------|
| Claude Code | `claude --print -p <prompt>` | ✅ Implemented |
| Mock | (internal) | ✅ For testing |
| Codex | TBD | 🔜 Planned |

### Output Streaming

Agent output is streamed line-by-line to Redis:

```json
// job:{id}:output (Redis List)
{"timestamp": 1701561234567, "line": "Reading file...", "stream": "stdout"}
{"timestamp": 1701561234568, "line": "Modified 3 files", "stream": "stdout"}
```

- **Real-time**: Each line pushed via `RPUSH`
- **Prefixed**: `stdout` or `stderr` for UI styling
- **Limited**: Max 10,000 lines (configurable)
- **TTL**: 24 hours

### Mock Mode

When `AI_ENABLED=false` or API key missing:
- Creates `.repobox-mock.md` placeholder file
- Useful for testing full pipeline without AI costs
- Logs what would have been executed
