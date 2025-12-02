# Phase 06 - Go Runner Core - Code Review

## Overview

Go-based job runner that consumes jobs from Redis Streams, executes git operations, and manages concurrent job processing with per-user limits. Implements `tasks/SPEC.MD#Runner` and `#Security`.

## Files Changed/Added

### New Files

| File | Purpose |
|------|---------|
| `apps/runner/internal/redis/keys.go` | Redis key constants matching web app |
| `apps/runner/internal/crypto/aes.go` | AES-256-GCM decryption compatible with TS |
| `apps/runner/internal/crypto/aes_test.go` | Crypto unit tests |
| `apps/runner/internal/git/git_test.go` | Git helper unit tests |
| `apps/runner/internal/worker/pool.go` | Worker pool with N goroutines |
| `apps/runner/internal/consumer/consumer.go` | Redis stream consumer |
| `apps/runner/internal/executor/executor.go` | Job execution logic |
| `apps/runner/README.md` | Runner documentation |
| `docs/plans/2025-12-02-go-runner-design.md` | Design document |

### Modified Files

| File | Changes |
|------|---------|
| `apps/runner/internal/config/config.go` | Added `MaxConcurrentJobs`, `MaxJobsPerUser`, validation |
| `apps/runner/internal/git/git.go` | Token embedding, masking, context support |
| `apps/runner/cmd/runner/main.go` | Full wiring with pool, consumer, executor |

## Implementation Details

### 6.1 Redis Stream Consumer

**Location:** `apps/runner/internal/consumer/consumer.go`

- Joins consumer group `jobs:stream:runners`
- Uses `XREADGROUP` with 5s block timeout
- Claims pending messages from dead consumers (5min idle)
- Per-user limit check before dispatching job
- Increments `runner:user:{userId}:running` counter

### 6.2 Worker Pool

**Location:** `apps/runner/internal/worker/pool.go`

- Configurable pool size via `MAX_CONCURRENT_JOBS` (default: 10)
- Buffered job channel (2x pool size)
- Graceful shutdown waits for in-flight jobs
- Each worker logs with `worker_id` context

### 6.3 Job Executor

**Location:** `apps/runner/internal/executor/executor.go`

- Updates job status to `running` with `startedAt`
- Fetches encrypted token from `git_provider:{userId}:{providerId}`
- Decrypts using AES-256-GCM
- Git flow:
  1. Clone with token-embedded URL
  2. Create branch `repobox/{job-id-prefix}`
  3. (Phase 07: AI agent placeholder)
  4. Commit with prompt-based message
  5. Push to remote
- Updates status to `success`/`failed` with `finishedAt`
- Appends output lines to `job:{id}:output` list

### 6.4 Git Helper

**Location:** `apps/runner/internal/git/git.go`

- Token embedding: `https://oauth2:TOKEN@host/repo.git`
- Token masking: `ghp_****xxxx` in all logs/errors
- Context-aware commands with timeout
- Diff stats for lines added/removed

### 6.5 Crypto

**Location:** `apps/runner/internal/crypto/aes.go`

- AES-256-GCM decryption
- Compatible with web app format: `iv:authTag:ciphertext` (base64)
- Supports key formats: 64 hex chars, 44 base64 chars, 32 raw chars

### 6.6 Graceful Shutdown

- SIGINT/SIGTERM triggers context cancellation
- Consumer stops reading new jobs
- Worker pool waits for in-flight jobs
- User counters decremented via `AckJob()`

## Test Coverage

```bash
$ go test ./internal/crypto/... ./internal/git/... -v

=== RUN   TestDecryptor_Decrypt
--- PASS: TestDecryptor_Decrypt (0.00s)
    --- PASS: TestDecryptor_Decrypt/simple_token
    --- PASS: TestDecryptor_Decrypt/short_text
    --- PASS: TestDecryptor_Decrypt/long_text
    --- PASS: TestDecryptor_Decrypt/special_chars

=== RUN   TestDecryptor_InvalidFormat
--- PASS: TestDecryptor_InvalidFormat (0.00s)

=== RUN   TestNewDecryptor_KeyFormats
--- PASS: TestNewDecryptor_KeyFormats (0.00s)

=== RUN   TestEmbedToken
--- PASS: TestEmbedToken (0.00s)
    --- PASS: TestEmbedToken/github_https
    --- PASS: TestEmbedToken/gitlab_https
    --- PASS: TestEmbedToken/self-hosted_gitlab
    --- PASS: TestEmbedToken/ssh_url_rejected

=== RUN   TestMaskToken
--- PASS: TestMaskToken (0.00s)

=== RUN   TestMaskTokenInString
--- PASS: TestMaskTokenInString (0.00s)

PASS
```

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Runner connects to Redis, receives jobs | ✅ |
| Status transitions correctly (pending → running → success/failed) | ✅ |
| Git clone/branch/commit/push works with tokens | ✅ |
| Tokens never leaked in logs | ✅ |
| Runner shuts down gracefully | ✅ |
| Per-user job limits enforced | ✅ |
| Worker pool scales to MAX_CONCURRENT_JOBS | ✅ |

## Quality Checks

```
task build:runner - PASSED
├── go mod tidy: ✅
├── go build: ✅
└── go test: ✅ (crypto, git packages)
```

## Configuration

| ENV Variable | Default | Description |
|--------------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `ENCRYPTION_KEY` | required | 32-byte AES key |
| `RUNNER_ID` | `runner-1` | Unique identifier |
| `MAX_CONCURRENT_JOBS` | `10` | Worker pool size |
| `MAX_JOBS_PER_USER` | `3` | Per-user limit |
| `JOB_TIMEOUT` | `3600` | Job timeout (seconds) |
| `TEMP_DIR` | `/tmp/repobox` | Clone directory |
| `CLEANUP_AFTER_JOB` | `true` | Delete temp after job |

## Technical Notes

1. **Structured Logging:** JSON with `slog`, includes job_id, user_id, worker_id
2. **Redis Compatibility:** Keys match web app `repositories/keys.ts`
3. **Token Security:** Never stored in memory longer than needed
4. **Context Propagation:** All git commands respect timeout context
5. **Error Recovery:** Worker panics recovered, job marked failed

## Dependencies

- Phase 03 (git providers with encrypted tokens) ✅
- Phase 04 (Redis repositories for jobs) ✅

## Breaking Changes

None. Runner is new component.

## Future Work

- Phase 07: AI agent integration (Claude API call)
- Phase 08: Real-time output streaming via SSE
- Phase 09: MR/PR creation automation

---

*Reviewed: 2024-12-02*
