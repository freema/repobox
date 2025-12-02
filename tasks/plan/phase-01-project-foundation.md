# Phase 01 - Project Foundation

## Overview
Establish the mono-repository, baseline applications, shared tooling, and CI so that later phases can build on a consistent foundation. Mirrors the "Architecture Overview" and "Deployment" guidance in `tasks/SPEC.MD`.

## Objectives
- Turborepo workspace with pnpm and shared scripts.
- Next.js 15 web app skeleton with strict TypeScript and Tailwind 4.
- Go runner module with idiomatic structure (cmd/internal/pkg) and Makefile.
- Shared TypeScript types package for data contracts between web and runner.
- Development environment helpers (Docker Compose, env templates, linting, CI).

## Deliverables
- Repository tree as illustrated in the original plan (apps/, packages/, docker/, .github/ etc.).
- Project level scripts (`turbo.json`, `pnpm-workspace.yaml`, root `package.json`).
- Minimal yet compilable Next.js app and Go runner.
- `.env.example`, `.gitignore`, Docker Compose for Redis.
- CI workflows for JS lint/type-check and Go tests.

## Work items
### 1.1 Monorepo setup
- [x] Initialize pnpm workspace and Turborepo.
- [x] Add root scripts for build/dev/lint/test in `turbo.json`.
- [x] Configure `pnpm-workspace.yaml` to include apps/* and packages/*.

### 1.2 Next.js web app (`apps/web`)
- [x] Bootstrap Next.js 15 + React 19 app router project.
- [x] Enable strict TypeScript, Tailwind CSS 4, ESLint + Prettier.
- [x] Configure Turbopack for `pnpm dev`.

### 1.3 Go runner module (`apps/runner`)
- [x] `go mod init`, create `cmd/runner/main.go` wiring basic service.
- [x] Create `internal/` packages for config, job, git, redis clients.
- [x] Provide Makefile targets for build/test/lint.

### 1.4 Shared types package (`packages/types`)
- [x] Create package with tsconfig, package.json.
- [x] Define Redis schema types: User, Session, Job, GitProvider, Repository, TokenVerification.
- [x] Export API response DTOs.

### 1.5 Dev environment
- [x] `docker/docker-compose.dev.yml` spinning Redis 7 with persistent volume.
- [x] `.env.example` covering auth, Redis, encryption, runner, AI keys (as in spec).
- [x] `.gitignore` updates for Node, Go, local env files.
- [x] **BONUS:** Full Docker-based development (Node + Go + Redis all in containers)
- [x] **BONUS:** Taskfile.yml for simplified task running

### 1.6 CI/CD basics
- [x] GitHub Actions workflow for JS lint + type-check via pnpm.
- [x] Workflow for Go tests.

## Technical notes
- Use Turbo schema v2 with `globalDependencies: [".env"]` and caching disabled for dev tasks.
- Tailwind 4 requires postcss config update once available; track release notes.
- Prefer `make lint` to wrap `golangci-lint` once introduced in later phases.
- **DECISION:** All development happens in Docker containers - no local Go/Node installs required.

## Dependencies
- None (bootstrap phase).

## Acceptance criteria
- [x] `task dev` starts all services (Redis, Web, Runner) in Docker.
- [x] Web app serves on localhost:3000.
- [x] Runner connects to Redis successfully.
- [x] node_modules visible locally for IDE autocomplete.
- [x] GitHub Actions workflows defined.

## References
- `tasks/SPEC.MD#Architecture-Overview`
- `tasks/SPEC.MD#Configuration`
- `tasks/SPEC.MD#Deployment`
