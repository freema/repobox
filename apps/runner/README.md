# Repobox Runner

Go-based job runner for Repobox. Consumes jobs from Redis Streams, executes git operations, and orchestrates AI agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GO RUNNER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Consumer (1 goroutine)                                         │
│  ├── Reads jobs from Redis Stream "jobs:stream"                 │
│  ├── Checks per-user job limits                                 │
│  └── Dispatches to worker pool                                  │
│                                                                 │
│  Worker Pool (N goroutines)                                     │
│  ├── Clone repository with authenticated URL                   │
│  ├── Create feature branch                                      │
│  ├── Execute AI agent (Phase 07)                                │
│  ├── Commit and push changes                                    │
│  └── Update job status in Redis                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

All configuration via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `ENCRYPTION_KEY` | **Yes** | - | 32-byte key for AES-256-GCM (hex, base64, or raw) |
| `RUNNER_ID` | No | `runner-1` | Unique runner identifier |
| `MAX_CONCURRENT_JOBS` | No | `10` | Total worker pool size |
| `MAX_JOBS_PER_USER` | No | `3` | Max concurrent jobs per user |
| `JOB_TIMEOUT` | No | `3600` | Job timeout in seconds (1h) |
| `TEMP_DIR` | No | `/tmp/repobox` | Directory for git clones |
| `CLEANUP_AFTER_JOB` | No | `true` | Delete temp dir after job |

## Features

### Worker Pool
- Configurable number of concurrent workers
- Per-user job limits to ensure fairness
- Graceful shutdown - waits for in-flight jobs

### Git Operations
- Token embedding in HTTPS URLs (`oauth2:TOKEN@host`)
- Automatic token masking in logs and errors
- Support for GitHub and GitLab

### Security
- AES-256-GCM decryption compatible with web app
- Tokens never logged in plaintext
- Temp directories cleaned after each job

### Observability
- Structured JSON logging with job context
- Job output streaming to Redis
- Status updates throughout job lifecycle

## Development

```bash
# Build runner
task build:runner

# Run all services
task dev

# View runner logs
task logs:runner

# Run tests
docker run --rm -v "$(pwd)":/app -w /app golang:1.23-alpine go test ./...
```

## Package Structure

```
apps/runner/
├── cmd/runner/main.go           # Entry point
├── internal/
│   ├── config/config.go         # ENV parsing
│   ├── redis/
│   │   ├── client.go            # Redis connection
│   │   └── keys.go              # Key constants
│   ├── job/job.go               # Job struct & statuses
│   ├── git/
│   │   ├── git.go               # Git operations
│   │   └── git_test.go          # Tests
│   ├── crypto/
│   │   ├── aes.go               # AES-256-GCM decrypt
│   │   └── aes_test.go          # Tests
│   ├── consumer/
│   │   └── consumer.go          # Stream consumer
│   ├── executor/
│   │   └── executor.go          # Job execution
│   └── worker/
│       └── pool.go              # Worker pool
```

## Job Flow

1. Web app creates job in Redis hash and enqueues to stream
2. Consumer reads from stream using `XREADGROUP`
3. Per-user limit checked via `runner:user:{userId}:running` counter
4. Job dispatched to available worker
5. Worker:
   - Updates job status to `running`
   - Fetches and decrypts git provider token
   - Clones repo, creates branch `repobox/{job-id-prefix}`
   - (Phase 07: AI agent modifies code)
   - Commits and pushes changes
   - Updates job status to `success` or `failed`
6. ACK stream message, decrement user counter
