# Phase 04 - Redis Data Layer

## Overview
Implement typed repositories and utilities for all Redis stored entities plus job queue streams. This is the backbone for both the web app and runner. Mirrors `tasks/SPEC.MD#Data-Model`.

## Objectives
- Centralized Redis client with pooling, retry, and error logging.
- Repository pattern covering Users, Sessions, GitProviders, Jobs.
- Redis Streams for job queue (`jobs:stream`) and job output channels.
- Secondary indexes (sorted sets, sets) for efficient queries.
- Unit tests for repositories.

## Deliverables
- `packages/types` definitions for all hashes, DTOs.
- `apps/web/src/lib/redis` (or shared lib) exposing configured ioredis instance.
- Repository classes with CRUD operations and serialization helpers.
- Stream helpers for enqueueing jobs and reading output.
- Tests (Vitest/Jest for TS code) covering serialization logic.

## Work items
### 4.1 Redis client
- [ ] Configure ioredis with retry strategy (`Math.min(times * 50, 2000)`).
- [ ] Global error handling + metrics hooks stub.

### 4.2 Repository pattern
- [ ] `UserRepository`, `SessionRepository`, `GitProviderRepository`, `JobRepository`.
- [ ] Serialization helpers converting between JS objects and Redis hashes.
- [ ] Batch fetching with pipelines where needed.

### 4.3 Redis streams
- [ ] `jobs:stream` XADD helper triggered from job creation API.
- [ ] Consumer group utilities (for Go runner it will use go-redis but define schema here).
- [ ] Job output stream per job (`job:{id}:output`).

### 4.4 Indexes
- [ ] Sorted set `jobs:user:{userId}` for history.
- [ ] Set `git_providers:{userId}` referencing provider ids.
- [ ] Document TTL strategy where applicable (sessions).

## Technical notes
- Keep repository interfaces framework agnostic to reuse from API routes and server actions.
- For jobs store numeric timestamps as millis to avoid parsing confusion.
- Provide mock Redis implementation for tests to avoid hitting real Redis.

## Dependencies
- Phase 01 (shared types package, base project structure).

## Acceptance criteria
- [ ] Repositories support create/read/update/delete per schema.
- [ ] Job enqueue helper writes to stream + sorted set.
- [ ] Job output helper writes to `job:{id}:output`.
- [ ] Unit tests cover serialization/deserialization edge cases.

## References
- `tasks/SPEC.MD#Data-Model`
- `tasks/SPEC.MD#Runner`
