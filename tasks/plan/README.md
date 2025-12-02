# Repobox - Modular Implementation Plan

This directory contains the split implementation plan for Repobox aligned with `tasks/SPEC.MD`. Each phase lives in its own Markdown file so we can iterate and run code reviews per phase.

## How to work with this plan
- Edit the dedicated phase file (`phase-XX-*.md`) instead of a monolithic document.
- After finishing or starting work on a task, update the status both in the **Todo Snapshot** below and in the respective phase file.
- During reviews always reference the concrete file + section (example: `tasks/plan/phase-04-redis-data-layer.md#repositories`).

## File structure
| File | Focus |
| --- | --- |
| `phase-01-project-foundation.md` | Monorepo, Next.js web, Go runner skeleton, shared packages |
| `phase-02-authentication.md` | NextAuth/LDAP, session layer, auth UI |
| `phase-03-git-providers.md` | GitLab/GitHub token management, repo listing, UI |
| `phase-04-redis-data-layer.md` | Data models, repositories, streams, indexes |
| `phase-05-dashboard-ui.md` | Dashboard, components, UX flow |
| `phase-06-go-runner-core.md` | Job consumer, git operations, runtime orchestration |
| `phase-07-ai-agent-integration.md` | Claude Code integration, output streaming |
| `phase-08-real-time-streaming.md` | SSE API, frontend client, output viewer |
| `phase-09-merge-request-automation.md` | MR/PR API clients, runner hooks, UI |
| `phase-10-polish-and-testing.md` | Tests, docs, security, edge cases |

## Todo snapshot
Statuses mirror the detailed checklists inside each phase file.

- [x] Phase 01 - Project Foundation ✅ COMPLETED 2024-12-02
- [ ] Phase 02 - Authentication System
- [ ] Phase 03 - Git Providers
- [ ] Phase 04 - Redis Data Layer
- [ ] Phase 05 - Dashboard UI
- [ ] Phase 06 - Go Runner Core
- [ ] Phase 07 - AI Agent Integration
- [ ] Phase 08 - Real-time Streaming
- [ ] Phase 09 - MR/PR Creation
- [ ] Phase 10 - Polish & Testing

> Tip: use `[-]` to mark "in progress" and `[x]` once a phase is complete.

## Related docs
- Product specification: `tasks/SPEC.MD`
- UI inspiration: see "User Interface" in the spec
- Deployment references: future `docs/` folder + `CONTRIBUTING.md`
- Code reviews: `tasks/reviews/` folder

