# Phase 06 - Go Runner Core

## Overview
Implement the Go-based runner responsible for consuming jobs from Redis Streams, executing git operations, orchestrating AI agents, and reporting status. Based on `tasks/SPEC.MD#Runner`.

## Objectives
- Robust job consumer loop with reconnect/backoff logic.
- Git helper wrapping clone/branch/commit/push with token masking.
- Job lifecycle management (pending -> running -> success/failed) with status updates in Redis.
- Temp workspace management and cleanup.
- Graceful shutdown handling.

## Deliverables
- `internal/runner` package with consumer, executor, status updater.
- `internal/git` package (as shown in original plan) with embed/mask helpers.
- `internal/config` for env parsing (Redis URL, job timeout, temp dir, runner id).
- `cmd/runner/main.go` wiring everything with signal handling.
- Unit tests for git helper and job executor edge cases.

## Work items
### 6.1 Redis stream consumer
- [ ] Connect using go-redis v9, join consumer group `jobs:stream:runners`.
- [ ] Acknowledge messages once processing succeeds, handle pending entries.
- [ ] Heartbeat/health logging.

### 6.2 Job executor
- [ ] Update job status to `running`, record `startedAt`.
- [ ] Fetch user git token from Redis (decrypt) using repositories built in Phase 04.
- [ ] Clone repo into temp dir, create branch `repobox/<job-id-prefix>`.
- [ ] After AI agent modifies repo, commit and push; on success update `branch` + `status`.

### 6.3 Git helper
- [ ] Wrapper for clone/create branch/commit/push with token embedding.
- [ ] Mask tokens in logs and errors.

### 6.4 Shutdown + observability
- [ ] Capture SIGINT/SIGTERM, finish in-flight job, close Redis connections.
- [ ] Structured logging (zap/slog) with job id context.

## Technical notes
- Use context timeouts per job (`JOB_TIMEOUT` env) and propagate to subprocesses (Phase 07 integration).
- Clean up temp directories even on failure; log path for debugging when needed.
- Keep metrics hooks for future Prometheus exporter.

## Dependencies
- Phase 04 (Redis repositories) and Phase 03 (encrypted tokens).

## Acceptance criteria
- [ ] Runner connects to Redis, receives jobs, updates status transitions correctly.
- [ ] Git clone/branch/commit/push works with provided tokens (tested via integration stub or mock repo).
- [ ] Tokens never leaked in logs.
- [ ] Runner shuts down gracefully.

## References
- `tasks/SPEC.MD#Runner`
- `tasks/SPEC.MD#Security`
