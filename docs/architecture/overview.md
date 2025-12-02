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
│   │  Settings   │      │  - Auth     │      │  - Jobs     │         │
│   │  Sessions   │      │  - API      │      │  - Providers│         │
│   └─────────────┘      │  - SSR      │      │  - Stream   │         │
│                        └─────────────┘      └──────┬──────┘         │
│                                                    │                │
│                                                    ▼                │
│                                             ┌─────────────┐         │
│   ┌─────────────┐      ┌─────────────┐      │  Go Runner  │         │
│   │   GitHub    │◀─────│     Git     │◀─────│             │         │
│   │   GitLab    │      │  Operations │      │  - Consumer │         │
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

## Data Flow

### Job Creation
1. User selects repo, writes prompt
2. Web app creates job hash in Redis
3. Web app adds message to `jobs:stream`
4. User sees job as "pending"

### Job Processing
1. Runner consumer reads from stream
2. Checks per-user limit
3. Worker claims job, updates to "running"
4. Git clone with authenticated URL
5. AI agent modifies code
6. Commit and push to new branch
7. Update job to "success"

### Real-time Updates
1. Client polls or SSE connection
2. Runner appends to `job:{id}:output`
3. Web app streams to browser

## Security Model

- **Authentication**: OAuth (GitHub/Google) or LDAP
- **Authorization**: User owns their jobs and providers
- **Secrets**: AES-256-GCM encrypted tokens in Redis
- **Tokens**: Masked in all logs (`ghp_****xxxx`)
- **Network**: Runner internal, no external access

## Scaling

| Component | Strategy |
|-----------|----------|
| Web App | Horizontal (stateless) |
| Redis | Single instance or cluster |
| Runner | Worker pool + horizontal |

## Implemented Phases

- [x] Phase 01: Project Foundation
- [x] Phase 02: Authentication
- [x] Phase 03: Git Providers
- [x] Phase 04: Redis Data Layer
- [x] Phase 05: Dashboard UI
- [x] Phase 06: Go Runner Core
- [ ] Phase 07: AI Agent Integration
- [ ] Phase 08: Real-time Streaming
- [ ] Phase 09: MR Automation
- [ ] Phase 10: Polish & Testing
