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
- [x] Implement crypto helpers (encrypt/decrypt) with random IV + auth tag.
- [x] Unit tests ensuring deterministic decrypt and masking of auth tag.

### 3.2 Git provider API
- [x] REST handlers performing validation, calling provider class, storing encrypted tokens.
- [x] Add rate limiting / throttling to verification endpoint (spec security requirement).

### 3.3 Repository listing
- [x] GitLab API client hitting `/api/v4/projects?membership=true`.
- [x] GitHub API client hitting `/user/repos` with pagination (up to 100).
- [x] Normalized repository DTO returned from `/api/repositories`.

### 3.4 Provider pattern
- [x] Interface definition in shared types.
- [x] `GitLabProvider`, `GitHubProvider` implementing interface.
- [x] Extendable registry for future providers (self-hosted base URLs).

### 3.5 Setup UI
- [x] `/setup` route with token form, validation states, verification status.
- [x] Provider list with remove button and metadata (repos count, last verified).
- [x] Repository browser component reused in dashboard.

## Technical notes
- Mask tokens in server logs and API responses (align with spec security section).
- Support custom GitLab base URL for self-hosted instances via form field.
- Cache repository lists per provider briefly (Redis key) to reduce API hits.

## Dependencies
- Phase 02 (authenticated user context + Redis connectivity).

## Acceptance criteria
- [x] User can add GitLab PAT and see verified status.
- [x] User can add GitHub PAT and see verified status.
- [x] Tokens stored encrypted in Redis with metadata.
- [x] `/api/repositories` returns combined list filtered by providers the user added.
- [x] User can delete provider and cache entries are cleared.

## References
- `tasks/SPEC.MD#Git-Providers`
- `tasks/SPEC.MD#Security`

## Implementation Details (Added during development)

### Files Created
- `apps/web/src/lib/crypto.ts` - AES-256-GCM encryption/decryption utilities
- `apps/web/src/lib/crypto.test.ts` - 14 unit tests for crypto module
- `apps/web/src/lib/git-providers/types.ts` - TypeScript interfaces for providers
- `apps/web/src/lib/git-providers/gitlab.ts` - GitLab API client implementation
- `apps/web/src/lib/git-providers/github.ts` - GitHub API client implementation
- `apps/web/src/lib/git-providers/repository.ts` - Redis storage for providers
- `apps/web/src/lib/git-providers/index.ts` - Provider registry and factory
- `apps/web/src/app/api/git-providers/route.ts` - POST/GET /api/git-providers
- `apps/web/src/app/api/git-providers/[id]/route.ts` - GET/DELETE /api/git-providers/[id]
- `apps/web/src/app/api/git-providers/[id]/verify/route.ts` - POST verify endpoint
- `apps/web/src/app/api/repositories/route.ts` - GET /api/repositories
- `apps/web/src/components/git-providers/provider-form.tsx` - Token input form
- `apps/web/src/components/git-providers/provider-list.tsx` - Provider list with actions
- `apps/web/src/components/git-providers/repository-browser.tsx` - Repository browser
- `apps/web/src/app/setup/page.tsx` - Setup page for managing providers

### Key Implementation Decisions
1. **AES-256-GCM Encryption**: Random IV per encryption, auth tag for integrity verification
2. **Rate Limiting**: 5 verifications per minute per user on /verify endpoint
3. **Repository Caching**: 5-minute Redis cache to reduce API calls
4. **Provider Pattern**: Interface-based design supporting custom base URLs
5. **Token Masking**: `maskToken()` helper shows only first/last 4 characters

### Redis Key Schema
```
git_provider:{user_id}:{provider_id} → Hash (provider data with encrypted token)
git_providers:{user_id} → Set (provider IDs for user)
repos_cache:{user_id}:{provider_id} → String (cached repo JSON, 5min TTL)
rate_limit:verify:{user_id} → Counter (rate limiting, 60s TTL)
```

### Dependencies Added
- `vitest` - Unit testing framework
