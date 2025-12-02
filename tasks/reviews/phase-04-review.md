# Phase 04 - Redis Data Layer - Code Review

## Overview

Implementation of typed repositories and utilities for all Redis stored entities plus job queue streams, serving as the backbone for both web app and runner.

## Files Changed/Added

### New Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/repositories/keys.ts` | Centralized Redis key patterns and TTL constants |
| `apps/web/src/lib/repositories/serialization.ts` | Hash serialization/deserialization helpers |
| `apps/web/src/lib/repositories/user.ts` | UserRepository - CRUD operations for users |
| `apps/web/src/lib/repositories/session.ts` | SessionRepository - Session management with TTL |
| `apps/web/src/lib/repositories/job.ts` | JobRepository - Job CRUD, output streaming, queue |
| `apps/web/src/lib/repositories/index.ts` | Barrel export for all repositories |
| `apps/web/src/lib/repositories/*.test.ts` | Unit tests for all repositories |
| `apps/web/vitest.config.ts` | Vitest configuration for testing |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/lib/redis.ts` | Enhanced with retry strategy, reconnect logic, graceful shutdown |
| `apps/web/tsconfig.json` | Added `@repobox/types` path alias |

## Implementation Details

### 4.1 Redis Client

**Location:** `apps/web/src/lib/redis.ts`

- Configured retry strategy with exponential backoff: `Math.min(times * 50, 2000)`
- Added reconnect on error for READONLY, ECONNRESET, ECONNREFUSED
- Singleton pattern with lazy connect
- Event logging for connect, error, reconnecting
- Graceful shutdown helper `closeRedis()`

### 4.2 Repository Pattern

**Location:** `apps/web/src/lib/repositories/`

#### Key Management (`keys.ts`)
- Centralized `REDIS_KEYS` constant with all key patterns per SPEC.MD
- TTL constants: session (7 days), repoCache (5 min), jobOutput (24 hours)

#### Serialization (`serialization.ts`)
- `toHash()` - Converts TS objects to Redis hash (camelCase → snake_case)
- `fromHash()` - Converts Redis hash to TS objects with type schema
- Handles: strings, numbers, booleans, optional values

#### UserRepository (`user.ts`)
- `createUser()`, `getUser()`, `updateUser()`, `updateUserLastLogin()`
- `deleteUser()`, `userExists()`
- Uses hash storage at `user:{userId}`

#### SessionRepository (`session.ts`)
- `createSession()` with TTL, `getSession()` with expiry check
- `extendSession()`, `deleteSession()`, `sessionExists()`
- `createUserSession()` helper for new logins
- Auto-deletes expired sessions on read

#### JobRepository (`job.ts`)
- CRUD: `createJob()`, `getJob()`, `updateJobStatus()`, `deleteJob()`
- Pagination: `getUserJobs()`, `getUserJobCount()`
- Uses sorted set `jobs:user:{userId}` for time-based ordering

### 4.3 Redis Streams

**Location:** `apps/web/src/lib/repositories/job.ts`

- `enqueueJob()` - XADD to `jobs:stream`
- `ensureConsumerGroup()` - Creates consumer group with MKSTREAM
- `getPendingJobs()` - XRANGE for monitoring
- Job output via `job:{id}:output` list with TTL:
  - `appendJobOutput()`, `getJobOutput()`, `getJobOutputCount()`

### 4.4 Indexes

- **User jobs:** Sorted set `jobs:user:{userId}` with createdAt as score
- **Git providers:** Set `git_providers:{userId}` (existing from Phase 03)
- **TTL:** Sessions (7d), job output (24h), repo cache (5m)

## Test Coverage

**75 tests passing:**

| Test File | Tests |
|-----------|-------|
| `serialization.test.ts` | 14 |
| `crypto.test.ts` | 14 |
| `user.test.ts` | 11 |
| `session.test.ts` | 13 |
| `job.test.ts` | 23 |

All tests use Vitest mocks without hitting real Redis.

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Repositories support CRUD per schema | ✅ |
| Job enqueue helper writes to stream + sorted set | ✅ |
| Job output helper writes to `job:{id}:output` | ✅ |
| Unit tests cover serialization/deserialization | ✅ |

## Quality Checks

```
task check - PASSED
├── type-check: ✅
├── lint: ✅ (1 warning in existing code)
├── format:check: ✅
└── test:run: ✅ (75 tests)
```

## Technical Notes

1. **Framework agnostic:** Repositories export plain functions, not classes
2. **Timestamps as millis:** All `createdAt`, `expiresAt`, etc. stored as numbers
3. **Pipeline for atomicity:** Session create, job create use pipelines
4. **Consumer group schema:** Defined for Go runner compatibility

## Dependencies

- Phase 01 (types package) ✅
- ioredis ^5.8.2 ✅

## Breaking Changes

None. New additions only.

---

*Reviewed: 2024-12-02*
