# Phase 01 - Project Foundation: Code Review

**Date:** 2024-12-02
**Status:** Ready for Review
**Reviewer:** TBD

---

## Summary

Phase 01 establishes the foundational monorepo structure for Repobox with full Docker-based development environment.

## What Was Implemented

### 1. Monorepo Structure
- **pnpm workspace** with Turborepo for task orchestration
- Root `package.json`, `turbo.json`, `pnpm-workspace.yaml`
- Two apps: `apps/web` (Next.js) and `apps/runner` (Go)
- One package: `packages/types` (shared TypeScript types)

### 2. Next.js Web App (`apps/web`)
- Next.js 15 with React 19
- Tailwind CSS 4 with PostCSS
- Turbopack for development
- Strict TypeScript configuration
- ESLint with Next.js config

**Key files:**
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`

### 3. Go Runner (`apps/runner`)
- Go 1.23 module structure
- `cmd/runner/main.go` - entry point
- `internal/config/` - configuration loading
- `internal/redis/` - Redis client wrapper
- `internal/job/` - job types
- `internal/git/` - git operations shell
- Dockerfile for containerized build
- Makefile for local development commands

**Key files:**
- `apps/runner/go.mod`
- `apps/runner/cmd/runner/main.go`
- `apps/runner/internal/config/config.go`
- `apps/runner/internal/redis/client.go`
- `apps/runner/internal/job/job.go`
- `apps/runner/internal/git/git.go`
- `apps/runner/Dockerfile`
- `apps/runner/Makefile`

### 4. Shared Types (`packages/types`)
- TypeScript package with shared types
- User, Session, Job, GitProvider, Repository types
- API response DTOs

**Key files:**
- `packages/types/package.json`
- `packages/types/tsconfig.json`
- `packages/types/src/index.ts`

### 5. Docker Development Environment
- **Full containerized development** - no local Node/Go required
- `docker-compose.dev.yml` with Redis, Web, and Runner services
- node_modules bind-mounted for IDE autocomplete
- Taskfile.yml for simplified commands

**Key files:**
- `docker/docker-compose.dev.yml`
- `Taskfile.yml`
- `.env.example`
- `.gitignore`
- `CLAUDE.md`

### 6. CI/CD
- GitHub Actions workflow for JS lint + type-check
- GitHub Actions workflow for Go tests

**Key files:**
- `.github/workflows/ci.yml`

---

## Architecture Decisions

### Decision 1: Full Docker Development
**Context:** User preference for containerized development, no local toolchain installs.

**Decision:** All development happens in Docker containers:
- Node.js web app runs in `node:20-alpine` container
- Go runner builds in `golang:1.23-alpine` container
- Redis runs in `redis:7-alpine` container

**Consequences:**
- ✅ No local Node.js/Go installation required
- ✅ Consistent environment across machines
- ✅ IDE autocomplete works (bind-mounted node_modules)
- ⚠️ Slightly slower than native development
- ⚠️ Requires Docker Desktop running

### Decision 2: Taskfile over Makefile
**Context:** Need simplified commands for Docker operations.

**Decision:** Use go-task (Taskfile.yml) as command runner.

**Consequences:**
- ✅ Clean YAML syntax
- ✅ Cross-platform compatibility
- ✅ Built-in help with `task --list`

### Decision 3: Bind Mount vs Named Volumes for node_modules
**Context:** IDE needs access to node_modules for autocomplete.

**Decision:** Bind mount entire project including node_modules.

**Consequences:**
- ✅ IDE TypeScript autocomplete works
- ✅ No manual sync needed
- ⚠️ Potential performance impact on macOS (mitigated by Docker's VirtioFS)

---

## Files Created

```
repobox/
├── .env.example
├── .gitignore
├── CLAUDE.md
├── LICENSE
├── README.md
├── Taskfile.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── runner/
│   │   ├── Dockerfile
│   │   ├── Makefile
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── cmd/
│   │   │   └── runner/
│   │   │       └── main.go
│   │   └── internal/
│   │       ├── config/
│   │       │   └── config.go
│   │       ├── git/
│   │       │   └── git.go
│   │       ├── job/
│   │       │   └── job.go
│   │       └── redis/
│   │           └── client.go
│   └── web/
│       ├── eslint.config.mjs
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       └── src/
│           └── app/
│               ├── globals.css
│               ├── layout.tsx
│               └── page.tsx
├── docker/
│   └── docker-compose.dev.yml
└── packages/
    └── types/
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

---

## Verification

### Commands Run Successfully
- [x] `task dev` - Starts all containers
- [x] `task ps` - Shows running containers
- [x] `task logs:web` - Shows Next.js logs with "Ready" message
- [x] `task logs:runner` - Shows "Connected to Redis" message
- [x] `task stop` - Stops all containers
- [x] Web accessible at http://localhost:3000

### Build Verification
- [x] `docker compose build runner` - Go runner builds successfully
- [x] Web container installs dependencies and starts Turbopack
- [x] node_modules visible locally for IDE

---

## Open Questions for Reviewer

1. **Tailwind 4 Config:** Currently using `@import "tailwindcss"` in globals.css. Is additional configuration needed?

2. **Go Module Path:** Using `github.com/repobox/runner` - should this be changed to match actual repo URL?

3. **CI Workflow:** Currently only defines lint/typecheck. Should we add Docker build verification?

---

## Checklist for Reviewer

- [ ] Review monorepo structure matches spec
- [ ] Verify TypeScript types cover all Redis schemas from spec
- [ ] Check Docker compose configuration
- [ ] Validate Taskfile commands work correctly
- [ ] Review Go code structure follows idiomatic patterns
- [ ] Confirm CI workflow will work on GitHub

---

## Next Steps

After approval, proceed to **Phase 02 - Authentication System**.
