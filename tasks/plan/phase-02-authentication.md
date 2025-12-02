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
- [ ] Install `next-auth` and required typings.
- [ ] Configure NextAuth with Redis adapter + JWT strategy (7-day maxAge).

### 2.2 OAuth providers
- [ ] GitHub provider wiring (client id/secret).
- [ ] Google provider wiring.
- [ ] Document placeholder for LDAP provider (design notes, env keys).

### 2.3 Session management
- [ ] Redis adapter implementation or wrapper for tokens/sessions.
- [ ] Cookie settings: httpOnly, secure in prod, sameSite=lax.
- [ ] Session expiration + refresh logic.

### 2.4 Auth UI & middleware
- [ ] `/login` page with provider buttons and error state.
- [ ] Auth middleware securing all non-public routes and handling redirects.
- [ ] Logout action clearing session (server action or route handler).

### 2.5 User storage
- [ ] Redis `user:{id}` hash schema, hydration helpers, repository.
- [ ] Create user record on first login; update `lastLoginAt` on every login.
- [ ] Minimal profile component in header (avatar, name, logout).

## Technical notes
- Store provider metadata on the JWT token for later auditing (spec Security section).
- Enforce email verification via provider data if available; fallback to spec-defined rules.
- For LDAP, document expected ENV keys even if not implemented yet.

## Dependencies
- Phase 01 (web app + Redis client infrastructure).

## Acceptance criteria
- [ ] GitHub OAuth login completes and session stored in Redis.
- [ ] Google OAuth login completes and session stored in Redis.
- [ ] Protected routes redirect anonymous users to `/login`.
- [ ] Redis contains user hash with provider metadata upon first login.
- [ ] Logout invalidates session cookie + Redis entry.

## References
- `tasks/SPEC.MD#Authentication`
- `tasks/SPEC.MD#Security`
