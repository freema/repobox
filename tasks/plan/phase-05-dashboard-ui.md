# Phase 05 - Dashboard UI

## Overview
Build the main user-facing experience inspired by Claude Code Web: layout, sessions list, prompt composition, settings entry points, and job detail views. Aligns with `tasks/SPEC.MD#User-Interface` and `#User-Flow`.

## Objectives
- Layout with header, sidebar (sessions), main workspace, quick actions panel.
- Components for repository/environment selectors, prompt input, session cards.
- Session detail page showing job output (to be wired with Phase 08 SSE) and MR/PR status.
- Settings page for providers (reuses components from Phase 03).
- Responsive design (desktop first) with optional theme toggle.

## Deliverables
- App Router segments (`app/(dashboard)/layout.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/sessions/[id]/page.tsx`).
- Component library under `src/components/` for selectors, lists, output viewer skeleton.
- Tailwind design tokens matching branding palette in spec.
- Loading/skeleton states for long running fetches.

## Work items
### 5.1 Layout
- [ ] Dashboard layout component enforcing auth and rendering sidebar/header.
- [ ] Responsive CSS (Flexbox/Grid) with sticky sidebar.

### 5.2 Dashboard page
- [ ] Repository selector integrated with `/api/repositories`.
- [ ] Environment selector dropdown (static options until Phase 07/runner support).
- [ ] Prompt textarea with validation, send button, command shortcuts.
- [ ] Sessions sidebar listing history (pulls from Jobs index).

### 5.3 Session detail
- [ ] Detail view showing job metadata, status badge, MR/PR link placeholder.
- [ ] Output viewer container (SSE wiring added in Phase 08).
- [ ] Re-run button stub calling future API.

### 5.4 Settings page
- [ ] Entry at `/settings` listing providers with add/remove actions.
- [ ] Profile info card.

### 5.5 Components
- [ ] `<RepositorySelector />`, `<EnvironmentSelector />`, `<PromptInput />`.
- [ ] `<SessionList />`, `<SessionCard />`, `<StatusBadge />`.
- [ ] `<OutputViewer />` placeholder (without streaming yet).

## Technical notes
- Use React Server Components for data fetching where possible; fall back to client components for interactive selectors.
- Add `data-testid` attributes matching future Playwright tests from Phase 10.
- Maintain accessible focus states and keyboard navigation for selectors.

## Dependencies
- Phase 02 (auth) and Phase 03 (providers) for data sources.

## Acceptance criteria
- [ ] Authenticated user sees dashboard layout with sample data.
- [ ] Repository selection + prompt form validation works client side.
- [ ] Sessions sidebar updates when new jobs arrive (polling or SWR placeholder).
- [ ] Settings page lists providers stored in Redis.

## References
- `tasks/SPEC.MD#User-Interface`
- `tasks/SPEC.MD#User-Flow`
