# Phase 02 - Authentication System

## Overview
Implement the login flows (GitHub OAuth, Google OAuth, future LDAP), session handling via Redis, and secure auth-aware UI. Aligns with `tasks/SPEC.MD#Authentication`.

## Objectives
- NextAuth.js (Auth.js v5) configured with Redis adapter.
- OAuth providers for GitHub + Google; abstraction point for LDAP provider later.
- Session storage with JWT strategy backed by Redis for persistence.
- Auth UI: login page, callback handling, logout, middleware for protected routes.
- Redis user schema creation on first login.

## Deliverables
- `auth.ts` exporting `handlers`, `auth`, `signIn`, `signOut`.
- Provider configuration with env-based secrets.
- Middleware that enforces auth except for public routes.
- Login page with provider buttons and branded copy (per spec branding).
- Redis helper functions for users and sessions.

## Work items
### 2.1 NextAuth setup
- [x] Install `next-auth` and required typings.
- [x] Configure NextAuth with Redis adapter + JWT strategy (7-day maxAge).

### 2.2 OAuth providers
- [x] GitHub provider wiring (client id/secret).
- [x] Google provider wiring.
- [x] Document placeholder for LDAP provider (design notes, env keys).

### 2.3 Session management
- [x] Redis adapter implementation or wrapper for tokens/sessions.
- [x] Cookie settings: httpOnly, secure in prod, sameSite=lax.
- [x] Session expiration + refresh logic.

### 2.4 Auth UI & middleware
- [x] `/login` page with provider buttons and error state.
- [x] Auth middleware securing all non-public routes and handling redirects.
- [x] Logout action clearing session (server action or route handler).

### 2.5 User storage
- [x] Redis `user:{id}` hash schema, hydration helpers, repository.
- [x] Create user record on first login; update `lastLoginAt` on every login.
- [x] Minimal profile component in header (avatar, name, logout).

## Technical notes
- Store provider metadata on the JWT token for later auditing (spec Security section).
- Enforce email verification via provider data if available; fallback to spec-defined rules.
- For LDAP, document expected ENV keys even if not implemented yet.

## Dependencies
- Phase 01 (web app + Redis client infrastructure).

## Acceptance criteria
- [x] GitHub OAuth login completes and session stored in Redis.
- [x] Google OAuth login completes and session stored in Redis.
- [x] Protected routes redirect anonymous users to `/login`.
- [x] Redis contains user hash with provider metadata upon first login.
- [x] Logout invalidates session cookie + Redis entry.

## Implementation Details (Added during development)

### Files Created
- `apps/web/src/lib/auth.ts` - NextAuth configuration with hybrid JWT + Redis session storage
- `apps/web/src/lib/redis.ts` - Redis client with ioredis
- `apps/web/src/middleware.ts` - Auth middleware for protected routes
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` - NextAuth API route handler
- `apps/web/src/app/login/page.tsx` - Login page with GitHub/Google buttons
- `apps/web/src/components/user-menu.tsx` - User dropdown menu with logout
- `apps/web/src/types/next-auth.d.ts` - TypeScript type augmentations for NextAuth
- `docs/auth/ldap-integration.md` - LDAP integration documentation

### Key Implementation Decisions
1. **Hybrid Session Strategy**: JWT for primary session + Redis session ID for server-side invalidation
2. **Input Validation**: Zod schema validation for OAuth profile data
3. **Race Condition Prevention**: HSETNX pattern for atomic user creation
4. **Error Handling**: Structured logging with try-catch blocks for all Redis operations
5. **Force Logout Support**: `invalidateAllUserSessions()` function for security incidents

### Redis Key Schema
```
user:{provider}:{providerAccountId} → Hash (user data)
session:{sessionId} → String (userId) with TTL
user_sessions:{userId} → Set (sessionIds) with TTL
```

### Dependencies Added
- `next-auth@beta` (v5)
- `ioredis`
- `zod`
- `prettier`

## References
- `tasks/SPEC.MD#Authentication`
- `tasks/SPEC.MD#Security`
- `docs/auth/ldap-integration.md`
