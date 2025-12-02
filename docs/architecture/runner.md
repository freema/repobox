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
   - Clone → Branch → AI Agent → Commit → Push
   - Updates status to `success`/`failed`

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
