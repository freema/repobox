# Repobox Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                           REPOBOX                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │
│   │   Browser   │─────▶│   Next.js   │─────▶│    Redis    │         │
│   │             │      │   Web App   │      │             │         │
│   │  Dashboard  │◀─────│             │◀─────│  - Sessions │         │
│   │  Settings   │      │  - Auth     │      │  - WorkSess │         │
│   │  Sessions   │      │  - API      │      │  - Providers│         │
│   └─────────────┘      │  - SSR      │      │  - Streams  │         │
│                        └─────────────┘      └──────┬──────┘         │
│                                                    │                │
│                                                    ▼                │
│                                             ┌─────────────┐         │
│   ┌─────────────┐      ┌─────────────┐      │  Go Runner  │         │
│   │   GitHub    │◀─────│     Git     │◀─────│             │         │
│   │   GitLab    │      │  Operations │      │  - Session  │         │
│   │             │      │             │      │  - Workers  │         │
│   └─────────────┘      └─────────────┘      │  - Executor │         │
│                                             └─────────────┘         │
│                                                    │                │
│                                                    ▼                │
│                                             ┌─────────────┐         │
│                                             │  AI Agent   │         │
│                                             │  (Claude)   │         │
│                                             └─────────────┘         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind 4 |
| Backend | Next.js API Routes, Server Components |
| Database | Redis 7 (data + queue) |
| Runner | Go 1.23 |
| AI | Claude API (Anthropic) |
| Git | GitHub, GitLab (self-hosted) |
| Auth | NextAuth.js (GitHub, Google, LDAP) |

## Core Concepts

### Work Sessions

A **Work Session** represents an interactive coding session on a repository. Unlike one-shot jobs, sessions persist and allow multiple prompts before pushing changes.

```
Session Lifecycle:
  Create Session → Clone Repo → Ready → [Prompt → Run → Ready]* → Push & MR → Done
```

**Session States:**
| State | Description |
|-------|-------------|
| `initializing` | Cloning repository, creating branch |
| `ready` | Ready for prompts |
| `running` | AI agent executing prompt |
| `pushed` | Branch pushed, MR created |
| `archived` | Session ended (manual or timeout) |
| `failed` | Error occurred |

## Data Flow

### Session Creation
1. User selects repo, optionally writes initial prompt
2. Web app creates work session in Redis
3. Web app adds message to `work_sessions:init:stream`
4. Runner clones repo, creates work branch
5. Status updates to "ready"

### Prompt Execution
1. User writes prompt in ready session
2. Web app adds message to `work_sessions:jobs:stream`
3. Runner executes AI agent in existing workdir
4. Status: ready → running → ready
5. Changes accumulate in work branch

### Push & MR Creation
1. User clicks "Push & Create MR"
2. Web app adds message to `work_sessions:push:stream`
3. Runner pushes branch, creates MR via API
4. Status updates to "pushed"

### Real-time Updates
1. Client SSE connection to `/api/work-sessions/{id}/stream`
2. Runner appends to `work_session:{id}:output`
3. Web app streams to browser

## Security Model

- **Authentication**: OAuth (GitHub/Google) or LDAP
- **Authorization**: User owns their sessions and providers
- **Secrets**: AES-256-GCM encrypted tokens in Redis
- **Tokens**: Masked in all logs (`ghp_****xxxx`)
- **Network**: Runner internal, no external access

## Scaling

| Component | Strategy |
|-----------|----------|
| Web App | Horizontal (stateless) |
| Redis | Single instance or cluster |
| Runner | Worker pool + horizontal |

## Cleanup

Sessions are cleaned up when:
- User archives manually
- Session inactive for 24 hours
- Disk limit exceeded (oldest first)
- After push (optional)

## Implemented Phases

- [x] Phase 01: Project Foundation
- [x] Phase 02: Authentication
- [x] Phase 03: Git Providers
- [x] Phase 04: Redis Data Layer
- [x] Phase 05: Dashboard UI
- [x] Phase 06: Go Runner Core
- [x] Phase 07: Work Sessions (Iterative Mode)
- [ ] Phase 08: AI Agent Integration
- [ ] Phase 09: Polish & Testing
