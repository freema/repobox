# Go Runner Phase 06 - Design Document

## Overview

Go-based job runner that consumes jobs from Redis Streams, executes git operations, and manages concurrent job processing with per-user limits.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GO RUNNER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  main.go                                                        │
│  ├── Load config                                                │
│  ├── Connect Redis                                              │
│  ├── Start Worker Pool                                          │
│  ├── Start Consumer                                             │
│  └── Graceful shutdown (SIGINT/SIGTERM)                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Consumer (1 goroutine)                                  │    │
│  │ ├── XREADGROUP from "jobs:stream"                       │    │
│  │ ├── Check user limit (Redis counter)                    │    │
│  │ └── Send jobs to job channel                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                     │
│                           ▼                                     │
│                    [job channel]                                │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Worker Pool (N goroutines)                              │    │
│  │ ├── Worker 1 ──┐                                        │    │
│  │ ├── Worker 2 ──┼── Executor: clone → AI → commit → push │    │
│  │ └── Worker N ──┘                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration (ENV)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection URL |
| `ENCRYPTION_KEY` | Yes | - | 32-byte key for AES-256-GCM (hex, base64, or raw) |
| `RUNNER_ID` | No | `runner-1` | Unique runner identifier |
| `MAX_CONCURRENT_JOBS` | No | `10` | Total worker pool size |
| `MAX_JOBS_PER_USER` | No | `3` | Max concurrent jobs per user |
| `JOB_TIMEOUT` | No | `3600` | Job timeout in seconds |
| `TEMP_DIR` | No | `/tmp/repobox` | Directory for git clones |
| `CLEANUP_AFTER_JOB` | No | `true` | Delete temp dir after job |

## Redis Keys

### Existing (from web app)
- `jobs:stream` - Job queue stream
- `jobs:stream:runners` - Consumer group
- `job:{jobId}` - Job hash
- `job:{jobId}:output` - Job output list
- `git_provider:{userId}:{providerId}` - Provider with encrypted token

### New (runner tracking)
- `runner:user:{userId}:running` - Counter of running jobs per user

## Package Structure

```
apps/runner/
├── cmd/runner/main.go           # Entry point
├── internal/
│   ├── config/config.go         # ENV parsing
│   ├── redis/
│   │   ├── client.go            # Redis connection
│   │   └── keys.go              # Key constants
│   ├── job/job.go               # Job struct
│   ├── git/
│   │   ├── git.go               # Git operations
│   │   ├── token.go             # Token embed/mask
│   │   └── git_test.go          # Tests
│   ├── crypto/
│   │   └── aes.go               # AES-256-GCM decrypt
│   ├── consumer/
│   │   └── consumer.go          # Stream consumer
│   ├── executor/
│   │   └── executor.go          # Job execution
│   └── worker/
│       └── pool.go              # Worker pool
```

## Job Flow

1. **Consumer** reads from `jobs:stream` using `XREADGROUP`
2. **Check user limit**: `GET runner:user:{userId}:running`
   - If >= `MAX_JOBS_PER_USER`, put message back (NACK) and continue
3. **Increment counter**: `INCR runner:user:{userId}:running`
4. **Send to worker** via channel
5. **Worker executes**:
   - Update job status to `running` + `startedAt`
   - Fetch provider token from Redis, decrypt
   - Clone repo with embedded token
   - Create branch `repobox/{jobId-prefix}`
   - (Phase 07: Run AI agent)
   - Commit changes
   - Push branch
   - Update job status to `success` + `finishedAt`
6. **On completion/error**:
   - `DECR runner:user:{userId}:running`
   - `XACK` the stream message
   - Cleanup temp directory

## Git Token Handling

### Embedding token in URL
```
https://oauth2:{token}@github.com/user/repo.git
https://oauth2:{token}@gitlab.com/user/repo.git
```

### Token masking in logs
```go
// Input:  "ghp_1234567890abcdefghij"
// Output: "ghp_****ghij"
func maskToken(token string) string
```

### AES-256-GCM Decryption
Port from TypeScript `apps/web/src/lib/crypto.ts`:
- Format: `iv:authTag:ciphertext` (base64 encoded)
- IV: 12 bytes
- Auth tag: 16 bytes

## Graceful Shutdown

1. Receive `SIGINT` or `SIGTERM`
2. Stop accepting new jobs (close consumer)
3. Wait for in-flight jobs to complete (with timeout)
4. Decrement all user counters
5. Close Redis connection
6. Exit

## Error Handling

| Error | Action |
|-------|--------|
| Redis connection lost | Reconnect with exponential backoff |
| Job timeout | Kill process, mark job failed, cleanup |
| Git clone failed | Mark job failed with error message |
| Decryption failed | Mark job failed, log (without token) |
| Worker panic | Recover, mark job failed, continue |

## Logging

Structured logging with context:
```
{"level":"info","runner_id":"runner-1","job_id":"abc123","user_id":"user1","msg":"job started"}
{"level":"info","runner_id":"runner-1","job_id":"abc123","msg":"git clone completed","duration_ms":1234}
{"level":"error","runner_id":"runner-1","job_id":"abc123","error":"push failed: permission denied","msg":"job failed"}
```

Never log tokens - always mask.

## Testing Strategy

1. **Unit tests**: crypto, token masking, git URL building
2. **Integration test**: Full flow with mock git repo (local bare repo)
3. **Manual test**: Real GitHub/GitLab repo with test token
