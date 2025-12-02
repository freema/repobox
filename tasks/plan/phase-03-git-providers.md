# Phase 03 - Git Providers

## Overview
Allow users to add/manage GitLab and GitHub personal access tokens, verify them, list repositories, and expose provider data to the UI. Based on `tasks/SPEC.MD#Git-Providers`.

## Objectives
- Secure token encryption/decryption utility (AES-256-GCM) using `ENCRYPTION_KEY`.
- REST API routes for CRUD + verification of git providers.
- Provider abstraction with GitLab/GitHub concrete implementations.
- Repository listing endpoint aggregating all providers per user.
- Setup UI ("first run" or settings) to add/remove tokens and browse repos.

## Deliverables
- Crypto helper module with tests.
- API handlers: `POST /api/git-providers`, `GET /api/git-providers`, `DELETE /api/git-providers/[id]`, `POST /api/git-providers/[id]/verify`, `GET /api/repositories`.
- Provider classes with `verifyToken`, `listRepositories`, `getCloneUrl`, `createMergeRequest` stub.
- React components for provider list, token form, repository browser.
- Redis schema updates (`git_provider:{user_id}:{provider_id}` hashes + sets).

## Work items
### 3.1 Token encryption
- [ ] Implement crypto helpers (encrypt/decrypt) with random IV + auth tag.
- [ ] Unit tests ensuring deterministic decrypt and masking of auth tag.

### 3.2 Git provider API
- [ ] REST handlers performing validation, calling provider class, storing encrypted tokens.
- [ ] Add rate limiting / throttling to verification endpoint (spec security requirement).

### 3.3 Repository listing
- [ ] GitLab API client hitting `/api/v4/projects?membership=true`.
- [ ] GitHub API client hitting `/user/repos` with pagination (up to 100).
- [ ] Normalized repository DTO returned from `/api/repositories`.

### 3.4 Provider pattern
- [ ] Interface definition in shared types.
- [ ] `GitLabProvider`, `GitHubProvider` implementing interface.
- [ ] Extendable registry for future providers (self-hosted base URLs).

### 3.5 Setup UI
- [ ] `/setup` route with token form, validation states, verification status.
- [ ] Provider list with remove button and metadata (repos count, last verified).
- [ ] Repository browser component reused in dashboard.

## Technical notes
- Mask tokens in server logs and API responses (align with spec security section).
- Support custom GitLab base URL for self-hosted instances via form field.
- Cache repository lists per provider briefly (Redis key) to reduce API hits.

## Dependencies
- Phase 02 (authenticated user context + Redis connectivity).

## Acceptance criteria
- [ ] User can add GitLab PAT and see verified status.
- [ ] User can add GitHub PAT and see verified status.
- [ ] Tokens stored encrypted in Redis with metadata.
- [ ] `/api/repositories` returns combined list filtered by providers the user added.
- [ ] User can delete provider and cache entries are cleared.

## References
- `tasks/SPEC.MD#Git-Providers`
- `tasks/SPEC.MD#Security`
