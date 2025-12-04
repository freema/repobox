# Go Runner Architecture

## Overview

The Runner is a Go service that processes work sessions and jobs from Redis Stream queues. It handles git operations, orchestrates AI agents, manages session workdirs, and reports status back to the web app.

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        GO RUNNER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Session Consumer                         │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │ Init Stream │  │ Jobs Stream │  │ Push Stream │       │  │
│  │  │ (clone repo)│  │ (prompts)   │  │ (push & MR) │       │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │  │
│  │         │                │                │               │  │
│  │         ▼                ▼                ▼               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │InitExecutor │  │ JobExecutor │  │PushExecutor │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│                       ┌──────────────┐                          │
│                       │    Redis     │                          │
│                       │              │                          │
│                       │ - Sessions   │                          │
│                       │ - Output     │                          │
│                       │ - Providers  │                          │
│                       └──────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Work Session Model

Sessions allow iterative work on a repository with multiple prompts before pushing.

### Session States

| State | Description |
|-------|-------------|
| `initializing` | Cloning repo, creating work branch |
| `ready` | Workdir exists, waiting for prompt or push |
| `running` | AI agent executing prompt |
| `pushed` | Branch pushed, MR created |
| `archived` | Session ended (terminal) |
| `failed` | Error occurred (terminal) |

### Session Workdir

```
/tmp/repobox/sessions/{sessionId}/repo/
```

Workdirs persist between prompts and are cleaned up on:
- Archive (manual or automatic)
- 24h inactivity timeout
- Disk limit enforcement

## Data Flow

### Session Init (Clone)

1. **Web App** creates session in Redis:
   - `HSET work_session:{id}` - session metadata
   - `XADD work_sessions:init:stream` - init request

2. **InitExecutor** processes:
   - Fetches token from `git_provider:{userId}:{providerId}`
   - Creates workdir `/tmp/repobox/sessions/{id}/repo`
   - Clones repo with authenticated URL
   - Creates work branch `repobox/{sessionId}`
   - Updates status to `ready`

### Session Job (Prompt)

1. **Web App** submits prompt:
   - `XADD work_sessions:jobs:stream`

2. **JobExecutor** processes:
   - Updates status to `running`
   - Executes AI agent in existing workdir
   - Commits changes (no push)
   - Updates line counts
   - Updates status to `ready`

### Session Push (MR)

1. **Web App** requests push:
   - `XADD work_sessions:push:stream`

2. **PushExecutor** processes:
   - Pushes work branch to remote
   - Creates MR via GitHub/GitLab API
   - Updates session with MR URL
   - Updates status to `pushed`

## Redis Keys

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `work_session:{id}` | Hash | Session metadata |
| `work_session:{id}:output` | List | Combined output lines |
| `work_session:{id}:jobs` | List | Job IDs in session |
| `work_sessions:user:{userId}` | Sorted Set | User's sessions |
| `work_sessions:init:stream` | Stream | Init requests |
| `work_sessions:jobs:stream` | Stream | Prompt requests |
| `work_sessions:push:stream` | Stream | Push requests |

### Session Hash Fields

```
work_session:{id}
├── user_id
├── provider_id
├── repo_url
├── repo_name
├── base_branch
├── work_branch
├── status
├── job_count
├── total_lines_added
├── total_lines_removed
├── mr_url (optional)
├── mr_warning (optional)
├── error_message (optional)
├── last_activity_at
├── created_at
└── pushed_at (optional)
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_JOBS` | 10 | Total workers |
| `MAX_JOBS_PER_USER` | 3 | Per-user limit |
| `JOB_TIMEOUT` | 3600s | Max job duration |
| `CLEANUP_INTERVAL` | 1h | Cleanup check frequency |
| `CLEANUP_MAX_AGE` | 24h | Session timeout |
| `CLEANUP_MAX_DISK_MB` | 10240 | Disk limit for workdirs |

## Security

- **Token Encryption**: AES-256-GCM, format `iv:authTag:ciphertext`
- **Token Masking**: `ghp_****xxxx` in all logs
- **URL Embedding**: `https://oauth2:TOKEN@host/repo.git`
- **Cleanup**: Session workdirs removed on archive/timeout

## Scaling

### Horizontal (Multiple Runners)
- Each runner joins same consumer groups
- Redis distributes work automatically
- No coordination needed

### Vertical (More Workers)
- Increase `MAX_CONCURRENT_JOBS`
- Consider memory for git clones (~100MB each)
- CPU bound by AI agent calls

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Redis disconnect | Reconnect with backoff |
| Job timeout | Kill, mark session failed, keep workdir |
| Git clone fail | Mark session failed, log masked error |
| Worker panic | Recover, mark failed, continue |
| Shutdown signal | Finish in-flight, graceful stop |
| AI agent timeout | Kill process, mark job failed |
| AI agent exit code ≠ 0 | Mark job failed, session stays ready |
| Push fail | Set mr_warning, session stays ready |

## AI Agent Integration

The runner spawns AI agents as subprocesses to execute code changes.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     JobExecutor                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Existing Workdir (from InitExecutor)               │   │
│  │  /tmp/repobox/sessions/{sessionId}/repo             │   │
│  └───────────────────────────┬─────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    AI Agent                          │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │   Claude Code CLI (subprocess)                 │ │   │
│  │  │   claude --print -p "<prompt>"                 │ │   │
│  │  └────────────────────┬───────────────────────────┘ │   │
│  │                       │                              │   │
│  │                stdout/stderr                         │   │
│  │                       │                              │   │
│  │                       ▼                              │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │   Output Streaming → Redis                     │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Git Commit (no push - accumulates in work branch)  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent Interface

```go
type Agent interface {
    Execute(ctx context.Context, opts ExecuteOptions) error
}

type ExecuteOptions struct {
    WorkDir     string        // Session workdir (persists)
    Prompt      string        // User instruction
    Environment string        // Runtime environment
    SessionID   string        // For logging
    JobID       string        // For logging
    Output      OutputWriter  // Streaming callback
}
```

### Supported Providers

| Provider | CLI Command | Status |
|----------|-------------|--------|
| Claude Code | `claude --print -p <prompt>` | ✅ Implemented |
| Mock | (internal) | ✅ For testing |

### Output Streaming

Agent output is streamed line-by-line to Redis:

```json
// work_session:{id}:output (Redis List)
{"timestamp": 1701561234567, "line": "Reading file...", "stream": "stdout"}
{"timestamp": 1701561234568, "line": "Modified 3 files", "stream": "stdout"}
```

- **Real-time**: Each line pushed via `RPUSH`
- **Prefixed**: `stdout` or `stderr` for UI styling
- **Limited**: Max 10,000 lines (configurable)
- **Combined**: All prompts in session share one output list

### Mock Mode

When `AI_ENABLED=false` or API key missing:
- Creates `.repobox-mock.md` placeholder file
- Useful for testing full pipeline without AI costs
- Logs what would have been executed

## Cleanup

The cleanup system runs periodically and on startup.

### Cleanup Rules

1. **24h Timeout**: Sessions with `lastActivityAt` older than 24h are archived
2. **Disk Limit**: When exceeded, oldest sessions are removed first
3. **Post-Push**: Workdirs for pushed sessions can be cleaned immediately
4. **Orphaned**: Workdirs without Redis metadata are removed

### Cleanup Process

```go
cleaner.cleanOldSessions(ctx)
├── Read session directories
├── For each session:
│   ├── Check Redis status
│   ├── If archived/pushed → remove workdir
│   ├── If lastActivityAt > 24h → archive + remove
│   └── If orphaned (no Redis) → remove
└── Log cleanup stats
```
