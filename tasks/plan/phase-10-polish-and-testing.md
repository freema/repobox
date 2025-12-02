# Phase 10 - Polish and Testing

## Overview
Final hardening phase covering automated tests, documentation, error handling, and security review so the project is production ready. Mirrors `tasks/SPEC.MD#Polish-Testing` (section 10 of original plan) plus `#Security`, `#Deployment`.

## Objectives
- Playwright E2E suite for auth + job creation flow + streaming verification.
- Unit tests across web (API routes, components) and runner (Go packages).
- Integration tests for Redis repositories and git operations (mock server or sandbox repo).
- Error handling improvements (global error boundary, API responses, user friendly messages).
- Documentation updates (README, CONTRIBUTING, API docs) and security review checklist.

## Deliverables
- `e2e/` directory with Playwright config + `job-flow.spec.ts`.
- Test coverage targets (>70% units) and CI integration.
- Error boundary component, consistent API error payload format.
- Updated README + CONTRIBUTING + setup guides.
- Security/edge-case checklist results recorded in this file or separate doc.

## Work items
### 10.1 E2E testing
- [ ] Playwright setup with fixtures for mocked OAuth and Redis.
- [ ] Tests for login, job creation, real-time output, MR link presence.

### 10.2 Unit tests
- [ ] Web API route tests (Next.js route handlers) using Vitest/Jest.
- [ ] Component tests (React Testing Library) for selectors, prompt input, output viewer.
- [ ] Runner Go unit tests for git helper, agent wrapper, job executor.

### 10.3 Integration tests
- [ ] Redis repository integration using test container.
- [ ] Git operations using local bare repo fixture.

### 10.4 Error handling
- [ ] Global error boundary for dashboard.
- [ ] API error utility returning structured JSON with code/message.
- [ ] User facing error toasts/snackbars.

### 10.5 Documentation
- [ ] Update project README with setup, architecture diagrams, screenshots.
- [ ] Write `CONTRIBUTING.md` and `docs/` guides (setup, configuration, API).

### 10.6 Edge cases & security
- [ ] Large output handling, long running jobs, concurrent limits.
- [ ] Token encryption audit, session security review, rate limiting.

## Technical notes
- Consider GitHub Actions matrix to run Playwright with Redis service container.
- Use coverage thresholds enforced by CI (nyc for TS, go test -cover for runner).
- Document known limitations for future roadmap.

## Dependencies
- All previous phases must be feature complete.

## Acceptance criteria
- [ ] Playwright suite passes locally and in CI.
- [ ] Unit + integration tests reach coverage target.
- [ ] README/CONTRIBUTING/docs updated and reviewed.
- [ ] Security review checklist completed with action items resolved.

## References
- `tasks/SPEC.MD#Security`
- `tasks/SPEC.MD#Deployment`
- `tasks/SPEC.MD#Roadmap`
