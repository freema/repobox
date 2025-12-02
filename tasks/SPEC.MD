# Repobox

> Self-hosted AI Code Agent Platform

**Version:** 1.0 Draft  
**Last Updated:** December 2024

---

## Table of Contents

1. [Vision](#vision)
2. [Problem Statement](#problem-statement)
3. [Target Users](#target-users)
4. [Architecture Overview](#architecture-overview)
5. [User Flow](#user-flow)
6. [Authentication](#authentication)
7. [Git Providers](#git-providers)
8. [User Interface](#user-interface)
9. [Runner](#runner)
10. [Data Model](#data-model)
11. [Configuration](#configuration)
12. [Environments](#environments)
13. [Deployment](#deployment)
14. [Security](#security)
15. [Roadmap](#roadmap)
16. [Non-Goals](#non-goals)

---

## Vision

Repobox is an open-source, self-hosted alternative to Claude Code Web. It enables developers and teams to run AI-powered code agents in isolated containers that can clone repositories, make changes, and create merge requests automatically.

The name "Repobox" reflects the core concept: repositories running in isolated boxes (containers). The logo is a pixel art mimic chest (D&D style) - a treasure chest that's actually alive, representing the AI agent hidden inside.

---

## Problem Statement

Current AI coding assistants like Claude Code Web are cloud-only solutions. Organizations need:

- **Self-hosted solution** for security and compliance
- **Integration with private GitLab/GitHub instances** including self-hosted GitLab
- **Isolated execution environments** for each task
- **Flexibility to use different AI providers** (Claude Code, Codex, etc.)
- **Support for enterprise authentication** (LDAP, SSO)
- **Control over their data and code**

---

## Target Users

### Primary
Marketing agency (initial client) with own GitLab instance and LDAP authentication.

### Secondary
Development teams wanting self-hosted AI coding assistance with enterprise authentication.

### Tertiary
Open source community looking for self-hosted Claude Code Web alternative.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         REPOBOX                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   Web App   │      │    Redis    │      │   Runner    │     │
│  │  (Next.js)  │◄────►│   Streams   │◄────►│    (Go)     │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│        │                    │                     │             │
│        │                    │                     │             │
│        ▼                    ▼                     ▼             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │    Auth     │      │   Storage   │      │  AI Agent   │     │
│  │  Providers  │      │  (per-user) │      │(Claude Code)│     │
│  │             │      │             │      │             │     │
│  │ • GitHub    │      │ • Users     │      │ • Clone     │     │
│  │ • Google    │      │ • Sessions  │      │ • Execute   │     │
│  │ • LDAP      │      │ • Git tokens│      │ • Push      │     │
│  │             │      │ • Jobs      │      │ • Create MR │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web App | Next.js | User interface, authentication, job management |
| Runner | Go | Job orchestration, git operations, process management |
| AI Agent | Claude Code / Codex | Actual code changes (spawned by Runner) |
| Message Queue | Redis Streams | Job queue, real-time communication |
| Storage | Redis | Users, sessions, git tokens, jobs, logs |

### Design Principles

- **Adapter/Provider Pattern** - All integrations (auth, git, AI, queue) use adapter pattern for flexibility
- **Isolation** - Each job runs in a temporary directory, cleaned up after completion
- **Stateless Runners** - Runners can be scaled horizontally
- **No Database** - Redis-only for simplicity and lightweight deployment
- **Per-user Git Tokens** - Each user manages their own repository access

---

## User Flow

### First Time User

```
1. User opens Repobox
2. User logs in via GitHub OAuth / Google OAuth / LDAP
3. User is prompted to add Git provider tokens
4. User adds GitLab and/or GitHub Personal Access Token
5. Repobox verifies tokens and loads available repositories
6. User selects a repository
7. User selects runtime environment (Default, PHP, Python, etc.)
8. User writes a prompt describing desired changes
9. Job is created and sent to Runner via Redis Streams
10. Runner clones repository using user's token
11. Runner spawns AI agent (Claude Code)
12. AI agent makes changes
13. Runner creates branch, commits, pushes
14. Runner creates Merge Request / Pull Request via API
15. User sees real-time output and link to MR/PR
```

### Returning User

```
1. User opens Repobox
2. User logs in (session may still be active)
3. User sees dashboard with previous sessions
4. User selects repository and writes prompt
5. Job executes...
6. MR/PR created
```

---

## Authentication

Authentication handles **who the user is** and is separate from Git provider access.

### Supported Providers

| Provider | Method | Use Case |
|----------|--------|----------|
| GitHub OAuth | OAuth 2.0 | Developers with GitHub accounts |
| Google OAuth | OAuth 2.0 | General users, enterprise with Google Workspace |
| LDAP | LDAP bind | Enterprise with Active Directory / LDAP |

### Auth Provider Pattern

```
AuthProvider (interface)
├── GitHubOAuthProvider
│   └── OAuth 2.0 flow with GitHub
├── GoogleOAuthProvider
│   └── OAuth 2.0 flow with Google
└── LDAPProvider
    └── LDAP bind authentication
```

### Auth Flow

```
┌──────────┐     1. Redirect      ┌──────────┐
│  Repobox │ ──────────────────►  │  GitHub/ │
│  Web App │                      │  Google/ │
│          │ ◄──────────────────  │  LDAP    │
└──────────┘     2. Callback      └──────────┘
      │
      │ 3. Create session
      ▼
┌──────────┐
│  Redis   │  session:{cookie} → user_id
└──────────┘
```

### Configuration

Auth provider credentials are stored in `.env` file (application-level secrets):

```
GITHUB_OAUTH_CLIENT_ID=xxx
GITHUB_OAUTH_CLIENT_SECRET=xxx

GOOGLE_OAUTH_CLIENT_ID=xxx
GOOGLE_OAUTH_CLIENT_SECRET=xxx

LDAP_URL=ldap://ldap.company.com
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=xxx
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
```

---

## Git Providers

Git providers handle **where the code is** and are configured per-user.

### Supported Providers

| Provider | Token Type | Self-hosted Support |
|----------|------------|---------------------|
| GitLab | Personal Access Token | Full support |
| GitHub | Fine-grained PAT | github.com + Enterprise |

### Why Personal Access Tokens?

- Works with any GitLab/GitHub instance (no OAuth app registration needed)
- Works with LDAP-only GitLab instances
- User controls exact permissions
- Simple to implement and understand

### GitLab PAT

Required scopes: `api` (includes read/write repos, create MRs)

Git operations:
```
Clone: https://oauth2:<token>@gitlab.company.com/group/repo.git
Push:  Same URL (token embedded)
API:   Header "PRIVATE-TOKEN: <token>"
```

### GitHub Fine-grained PAT

Required permissions:
- Contents: Read and write
- Pull requests: Read and write  
- Metadata: Read

Git operations:
```
Clone: https://<username>:<token>@github.com/user/repo.git
Push:  Same URL (token embedded)
API:   Header "Authorization: Bearer <token>"
```

### Git Provider Pattern

```
GitProvider (interface)
├── GitLabProvider
│   ├── listRepositories(token) → []Repository
│   ├── clone(repoUrl, token, destPath)
│   ├── push(repoPath, branch, token)
│   └── createMergeRequest(projectId, title, source, target, token)
│
└── GitHubProvider
    ├── listRepositories(token) → []Repository
    ├── clone(repoUrl, token, destPath)
    ├── push(repoPath, branch, token)
    └── createPullRequest(owner, repo, title, head, base, token)
```

### Token Storage

Git provider tokens are stored per-user in Redis (encrypted):

```
git_provider:{user_id}:{provider_id} → {
  type: "gitlab" | "github"
  url: "https://gitlab.company.com"
  token: "encrypted:xxxxx"
  username: "tomas.grasl"
  verified: true
  repos_count: 15
  created_at: timestamp
}
```

---

## User Interface

UI is inspired by Claude Code Web - clean, focused, developer-friendly.

### Main Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🗃️ Repobox                                                          [TG]  │
├─────────────────────────────────────────┬───────────────────────────────────┤
│                                         │                                   │
│  ┌─────────────────────────────────┐    │             🗃️                   │
│  │ Ask Repobox to write code...    │    │           (logo)                  │
│  │                                 │    │                                   │
│  │                      [Send ↑]   │    │   ┌─────────────┐ ┌───────────┐  │
│  └─────────────────────────────────┘    │   │ repo-name ▼ │ │ Default ▼ │  │
│                                         │   └─────────────┘ └───────────┘  │
│  ┌─────────────────┐ ┌───────────────┐  │                                   │
│  │ ☐ repo-name  ▼  │ │ ○ Default ▼   │  │   ┌───────────────────────────┐  │
│  └─────────────────┘ └───────────────┘  │   │ Write a CLAUDE.md         │  │
│                                         │   │ Create or update my...    │  │
│  Sessions                    Active ▼   │   └───────────────────────────┘  │
│  ───────────────────────────────────    │                                   │
│                                         │   ┌───────────────────────────┐  │
│  Update README with link                │   │ Fix a small todo          │  │
│  group/project-a                        │   │ Search for TODO and...    │  │
│                                         │   └───────────────────────────┘  │
│  Add unit tests for service             │                                   │
│  group/project-b         +45 -0 ✓ Merged│   ┌───────────────────────────┐  │
│                                         │   │ Improve test coverage     │  │
│  Fix authentication bug                 │   │ Recommend areas to...     │  │
│  group/project-a        +12 -8 ✓ Merged │   └───────────────────────────┘  │
│                                         │                                   │
│  Refactor database layer                │                                   │
│  group/project-c       +80 -120 ⏳ Running│                                   │
│                                         │                                   │
├─────────────────────────────────────────┴───────────────────────────────────┤
│  [User] [Feedback] [Settings]                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Prompt Input | Top left | Main text input for AI prompts |
| Repository Selector | Below input | Dropdown with user's repos (GitLab/GitHub) |
| Environment Selector | Next to repo | Select runtime (Default, PHP, Python) |
| Sessions List | Left sidebar | History of jobs with status |
| Quick Actions | Right panel | Pre-defined prompt templates |
| Logo | Right panel center | Mimic chest branding |
| Status Bar | Bottom | User info, settings, feedback |

### Session States

| Status | Visual | Color |
|--------|--------|-------|
| Pending | ⏸ Pending | Gray |
| Running | ⏳ Running | Yellow |
| Success (MR open) | ↗ MR Open | Blue |
| Merged | ✓ Merged | Green |
| Failed | ✗ Failed | Red |
| Cancelled | ⊘ Cancelled | Gray |

### Pages

1. **Login Page** - Auth provider selection
2. **Setup Page** - First-time git token configuration
3. **Dashboard** - Main working interface (shown above)
4. **Settings** - Manage git providers, preferences
5. **Session Detail** - Full log output, MR link, re-run option

---

## Runner

The Runner is a Go binary that orchestrates job execution.

### Why Go?

- Single binary deployment (no dependencies)
- Excellent concurrency support for multiple jobs
- Small memory footprint
- Fast startup time
- Good learning opportunity for practical Go project

### Runner Responsibilities

1. **Job Consumer** - Listen to Redis Streams for new jobs
2. **Git Operations** - Clone, branch, commit, push using user's token
3. **Process Management** - Spawn AI agent as subprocess
4. **Output Streaming** - Push real-time output to Redis for UI
5. **Cleanup** - Remove temporary directories after job completion
6. **Health Checks** - Report runner status

### Job Lifecycle

```
PENDING → RUNNING → SUCCESS / FAILED
              ↓
         (can be)
              ↓
         CANCELLED
```

### Runner Flow

```
1. Runner polls Redis Streams for new jobs
2. Job received: {job_id, user_id, provider_id, repo_url, prompt}
3. Runner fetches user's git token from Redis (decrypts)
4. Runner creates temp directory
5. Runner clones repository using token
6. Runner spawns Claude Code with prompt
7. Runner streams stdout/stderr to Redis
8. On completion: commit, push, create MR/PR
9. Runner updates job status in Redis
10. Runner cleans up temp directory
```

---

## Data Model

All data stored in Redis.

### Users

```
user:{id} → Hash {
  id: string
  email: string
  name: string
  avatar_url: string
  auth_provider: "github" | "google" | "ldap"
  created_at: timestamp
  last_login_at: timestamp
}
```

### Sessions

```
session:{cookie} → Hash {
  user_id: string
  created_at: timestamp
  expires_at: timestamp
}
```

### Git Providers (per user)

```
git_provider:{user_id}:{provider_id} → Hash {
  id: string
  type: "gitlab" | "github"
  url: string
  token: string (encrypted)
  username: string
  verified: boolean
  repos_count: number
  created_at: timestamp
}

Index:
git_providers:{user_id} → Set [provider_id, ...]
```

### Jobs

```
job:{id} → Hash {
  id: string
  user_id: string
  provider_id: string
  repo_url: string
  repo_name: string
  branch: string
  prompt: string
  environment: string
  status: "pending" | "running" | "success" | "failed" | "cancelled"
  mr_url: string (nullable)
  lines_added: number
  lines_removed: number
  error_message: string (nullable)
  created_at: timestamp
  started_at: timestamp (nullable)
  finished_at: timestamp (nullable)
}
```

### Job Queue

```
Redis Streams for job queue:
jobs:stream → Stream {
  job_id: string
  user_id: string
  provider_id: string
  repo_url: string
  prompt: string
  environment: string
}

Consumer group for runners:
jobs:stream:runners → Consumer Group
```

### Job Output (for real-time streaming)

```
job:{id}:output → List [
  {timestamp, line, stream: "stdout" | "stderr"},
  ...
]
```

### User's Jobs Index

```
jobs:user:{user_id} → Sorted Set (job_id by timestamp)
```

---

## Configuration

### Application Configuration (.env)

```
# ===== AUTH PROVIDERS =====
# GitHub OAuth (for login)
GITHUB_OAUTH_CLIENT_ID=xxx
GITHUB_OAUTH_CLIENT_SECRET=xxx

# Google OAuth (for login)
GOOGLE_OAUTH_CLIENT_ID=xxx
GOOGLE_OAUTH_CLIENT_SECRET=xxx

# LDAP (for login)
LDAP_URL=ldap://ldap.company.com
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=xxx
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
LDAP_USER_FILTER=(uid={{username}})

# ===== INFRASTRUCTURE =====
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=32-byte-encryption-key-here

# ===== WEB APP =====
NEXT_PUBLIC_APP_URL=https://repobox.company.com
SESSION_SECRET=xxx
SESSION_MAX_AGE=604800

# ===== AI PROVIDER =====
ANTHROPIC_API_KEY=sk-ant-xxx

# ===== RUNNER =====
RUNNER_ID=runner-1
TEMP_DIR=/tmp/repobox
CLEANUP_AFTER_JOB=true
JOB_TIMEOUT=3600
```

---

## Environments

Users can select different runtime environments for their jobs.

| Environment | Base Image | Includes |
|-------------|------------|----------|
| Default | node:20-slim | Node.js, npm, git, Claude Code |
| Node.js Full | node:20 | Node.js, npm, yarn, pnpm, git |
| PHP | php:8.3-cli | PHP, Composer, Node.js, git |
| Python | python:3.12-slim | Python, pip, Node.js, git |
| Full Stack | ubuntu:24.04 | Node.js, PHP, Python, Ruby, Go, git |

Custom environments can be defined by users via Dockerfile.

---

## Deployment

### Open Source Repository Structure

```
repobox/
├── apps/
│   ├── web/                    # Next.js application
│   │   ├── src/
│   │   ├── package.json
│   │   └── Dockerfile
│   └── runner/                 # Go runner
│       ├── cmd/
│       ├── internal/
│       ├── go.mod
│       └── Dockerfile
├── docker/
│   ├── docker-compose.yml      # Reference compose
│   └── docker-compose.dev.yml  # Development compose
├── docs/
│   ├── setup.md
│   ├── configuration.md
│   └── api.md
├── .env.example
├── README.md
├── LICENSE                     # MIT
└── CONTRIBUTING.md
```

### Private Deployment Repository

For your own deployment, create a separate private repository:

```
repobox-deploy/
├── docker-compose.yml          # Production compose
├── docker-compose.override.yml # Environment overrides
├── .env                        # Real secrets (gitignored)
├── nginx/
│   └── nginx.conf              # Reverse proxy
├── .gitlab-ci.yml              # CI/CD pipeline
└── README.md                   # Internal docs
```

### Docker Images

Published to GitHub Container Registry:

```
ghcr.io/username/repobox-web:latest
ghcr.io/username/repobox-web:v1.0.0
ghcr.io/username/repobox-runner:latest
ghcr.io/username/repobox-runner:v1.0.0
```

### Production Docker Compose Example

```
services:
  web:
    image: ghcr.io/username/repobox-web:v1.0.0
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - redis

  runner:
    image: ghcr.io/username/repobox-runner:v1.0.0
    env_file: .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner-temp:/tmp/repobox
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
  runner-temp:
```

---

## Security

### Token Encryption

All git provider tokens are encrypted at rest using AES-256-GCM with a key from ENCRYPTION_KEY environment variable.

### Token Masking

Runner masks tokens in output streams before sending to Redis/UI.

### Session Security

- HTTP-only cookies
- Secure flag in production
- CSRF protection
- Session expiration

### Network Security

- HTTPS only in production
- Redis not exposed publicly
- Runner communicates only via Redis

### Audit Trail

All jobs are logged with:
- User ID
- Repository
- Prompt
- Timestamp
- Result

### Principle of Least Privilege

- Git tokens have only required scopes
- Each user can only access their own tokens
- Runner runs with minimal permissions

---

## Roadmap

### Phase 1 - MVP

- GitHub OAuth login
- Google OAuth login
- GitLab PAT support
- GitHub PAT support
- Single runner
- Claude Code integration
- Basic dashboard UI
- Job history
- Real-time output streaming
- MR/PR creation

### Phase 2 - Enterprise Ready

- LDAP authentication
- Multiple runners (horizontal scaling)
- Environment selection
- Job cancellation
- Re-run jobs
- Settings page

### Phase 3 - Advanced Features

- OIDC/SSO support
- Codex integration
- Custom AI providers
- Webhook triggers (on push, on MR comment)
- Team workspaces

### Phase 4 - Enterprise Plus

- Role-based access control
- Usage analytics
- Audit logs export
- Custom environments UI
- API access

---

## Non-Goals

The following are explicitly out of scope for this project:

- Real-time collaborative editing
- Code review automation (beyond creating MRs)
- CI/CD pipeline management
- IDE/editor integration
- Mobile application
- File storage / artifact management
- Built-in code hosting (we integrate with GitLab/GitHub)

---

## Success Metrics

- Successful MR/PR creation rate (target: >95%)
- Average job completion time (target: <5 minutes for typical tasks)
- User adoption within teams
- Community engagement (GitHub stars, forks, contributors)

---

## Appendix: Branding

### Logo

Repobox uses a pixel art mimic chest logo inspired by D&D. The mimic is a treasure chest that's actually a living creature - representing the AI agent hidden inside the "box" waiting to help with code.

### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Wood (light) | Peru | #CD853F |
| Wood (mid) | Sienna | #8B5A2B |
| Wood (dark) | Dark brown | #4A2C17 |
| Gold | Gold | #FFD700 |
| Gold (dark) | Dark goldenrod | #B8860B |
| Tongue | Crimson | #DC143C |
| Eyes | White | #FFFFFF |
| Pupils | Near black | #1A1A1A |
| Teeth | Beige | #F5F5DC |

---

*This document is a living specification and will be updated as the project evolves.*