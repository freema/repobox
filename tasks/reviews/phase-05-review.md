# Phase 05 - Dashboard UI - Code Review

## Overview

Build the main user-facing experience with dashboard layout, sessions list, prompt composition, settings entry points, and job detail views. Aligns with `tasks/SPEC.MD#User-Interface` and `#User-Flow`.

## Files Changed/Added

### New Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/(dashboard)/layout.tsx` | Dashboard layout with header, nav, auth guard |
| `apps/web/src/app/(dashboard)/page.tsx` | Dashboard home page (Server Component) |
| `apps/web/src/app/(dashboard)/dashboard-client.tsx` | Interactive dashboard client component |
| `apps/web/src/app/(dashboard)/sessions/[id]/page.tsx` | Session detail page with output viewer |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Settings page with profile and providers |
| `apps/web/src/app/(dashboard)/settings/settings-client.tsx` | Settings client component with delete |
| `apps/web/src/components/dashboard/repository-selector.tsx` | Repository dropdown with search |
| `apps/web/src/components/dashboard/environment-selector.tsx` | Environment preset selector |
| `apps/web/src/components/dashboard/prompt-input.tsx` | Prompt textarea with Cmd+Enter submit |
| `apps/web/src/components/dashboard/session-list.tsx` | Sessions sidebar with filtering |
| `apps/web/src/components/dashboard/session-card.tsx` | Session card with status and metadata |
| `apps/web/src/components/dashboard/status-badge.tsx` | Status badge for job states |
| `apps/web/src/components/dashboard/output-viewer.tsx` | Terminal output viewer |
| `apps/web/src/components/dashboard/index.ts` | Barrel export for dashboard components |

## Implementation Details

### 5.1 Layout

**Location:** `apps/web/src/app/(dashboard)/layout.tsx`

- Authenticated layout with redirect to `/login` if no session
- Checks for configured git providers, redirects to `/setup` if none
- Header with logo, navigation (Dashboard, Settings), UserMenu
- Responsive nav (hidden on mobile)
- `data-testid` attributes for Playwright

### 5.2 Dashboard Page

**Location:** `apps/web/src/app/(dashboard)/page.tsx`, `dashboard-client.tsx`

- Server Component fetches jobs via `getUserJobs()`
- Client Component manages state:
  - `selectedRepo` - Selected repository
  - `environment` - Runtime environment preset
  - `prompt` - User input text
  - `isSubmitting` - Submit loading state
- Three-column layout:
  - Sessions sidebar (left, 72rem)
  - Main workspace (center)
  - Quick actions panel (right, 64rem, hidden < xl)
- Quick action buttons pre-fill common prompts

### 5.3 Session Detail

**Location:** `apps/web/src/app/(dashboard)/sessions/[id]/page.tsx`

- Fetches job by ID with ownership check
- Displays:
  - Status badge
  - Prompt text
  - Repository/branch/environment metadata
  - Timestamps (created, started, finished, duration)
  - Lines changed for successful jobs
  - Error message for failed jobs
  - Output viewer with streaming indicator
- Action buttons:
  - View MR/PR (external link, shown on success)
  - Re-run (stub, future Phase 06)

### 5.4 Settings Page

**Location:** `apps/web/src/app/(dashboard)/settings/page.tsx`, `settings-client.tsx`

- Profile section with avatar (Next/Image), name, email
- Git providers list with:
  - Provider icon (GitHub/GitLab)
  - Username and verification badge
  - URL and repo count
  - Delete button with confirmation
- Add Provider button links to `/setup`
- Delete calls `DELETE /api/git-providers/[id]`

### 5.5 Components

**Location:** `apps/web/src/components/dashboard/`

#### RepositorySelector
- Fetches from `/api/repositories` on mount
- Search/filter functionality
- Loading skeleton state
- Error state handling
- Empty state with provider setup hint

#### EnvironmentSelector
- Static environment presets: default, nodejs-full, php, python, fullstack
- Native select with custom styling

#### PromptInput
- Auto-resizing textarea (max 200px)
- Cmd/Ctrl+Enter submit shortcut
- Send button with validation
- Keyboard hints display

#### SessionList
- Filter dropdown: All, Active, Success, Failed
- Empty states for no sessions/no matches
- Scrollable container

#### SessionCard
- Link to `/sessions/[id]`
- Prompt preview (truncated)
- Status badge (compact)
- Repo name and relative time
- Lines changed for success, error preview for failed

#### StatusBadge
- States: pending, running, success, failed, cancelled
- Each with icon, label, colors
- Optional label visibility

#### OutputViewer
- Monospace terminal styling
- Auto-scroll when streaming
- stdout/stderr color differentiation
- Streaming indicator with pulse animation

## Test Coverage

No new tests added - Phase 10 will add Playwright E2E tests.

All components include `data-testid` attributes for future testing:
- `dashboard-layout`, `dashboard-header`, `dashboard-main`
- `sessions-sidebar`, `main-workspace`, `quick-actions-panel`
- `repository-selector`, `environment-selector`, `prompt-input`
- `session-list`, `session-card`, `status-badge`
- `session-detail`, `settings-page`, `profile-section`
- `providers-list`, `provider-card`, etc.

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Authenticated user sees dashboard layout with sample data | ✅ |
| Repository selection + prompt form validation works client side | ✅ |
| Sessions sidebar updates when new jobs arrive (polling placeholder) | ⚠️ Polling not implemented, static fetch |
| Settings page lists providers stored in Redis | ✅ |

Note: Real-time session updates will be implemented in Phase 08 (SSE) or via SWR polling.

## Quality Checks

```
task check - PASSED
├── type-check: ✅
├── lint: ✅ (1 warning in existing gitlab.ts)
├── format:check: ✅
└── test:run: N/A (no new unit tests)
```

## Technical Notes

1. **React Server Components:** Layout and pages use RSC for data fetching
2. **Client Components:** Interactive elements marked with `"use client"`
3. **Tailwind 4:** Uses new color syntax (neutral-950, etc.)
4. **Dark theme:** Consistent neutral-800/900 color palette
5. **Responsive:** Desktop-first, sidebar hidden on smaller screens
6. **Accessibility:** Focus states on all interactive elements

## Dependencies

- Phase 02 (auth) ✅
- Phase 03 (git providers) ✅
- Phase 04 (Redis repositories) ✅

## Breaking Changes

None. New additions only.

## Future Work

- Phase 06: Job creation API to wire up submit button
- Phase 08: SSE streaming for real-time output
- Phase 10: Playwright E2E tests using data-testid

---

*Reviewed: 2024-12-02*
