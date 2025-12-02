# Phase 08 - Real-time Streaming

## Overview
Expose job output to the dashboard via Server-Sent Events (SSE) so users can watch progress live. Relies on Redis output streams produced in Phase 07. See `tasks/SPEC.MD#User-Flow` and `#Runner` sections about streaming.

## Objectives
- SSE API endpoint per job that replays historical output and tails new entries.
- Frontend client using `EventSource` with auto-reconnect and status updates.
- Output viewer component displaying stdout vs stderr with styling.
- Connection lifecycle management (close when job finishes, handle errors).

## Deliverables
- `app/api/jobs/[id]/stream/route.ts` SSE handler.
- Utility functions for reading Redis streams with blocking reads.
- Client-side hook/component to subscribe/unsubscribe.
- UI updates (OutputViewer) to show lines, auto scroll, handle done/error states.

## Work items
### 8.1 SSE endpoint
- [ ] Validate job exists before streaming; emit status event.
- [ ] Replay existing output via `XRANGE`, then tail via `XREAD BLOCK`.
- [ ] Detect job completion by checking status hash.

### 8.2 Frontend integration
- [ ] `useJobStream` hook (or inline effect) establishing `new EventSource`.
- [ ] Buffer lines in state, limit to prevent memory issues.
- [ ] Surface status updates to parent (session detail page badge).

### 8.3 Output viewer UX
- [ ] Terminal-like styling (dark background, monospace font).
- [ ] Different colors for stdout vs stderr.
- [ ] Auto scroll + manual pause toggle (optional nice-to-have).

### 8.4 Error handling
- [ ] Gracefully close SSE on network errors, allow manual retry.
- [ ] Show placeholder when no output available yet.

## Technical notes
- Keep SSE responses unbuffered (`Cache-Control: no-cache`, `Connection: keep-alive`).
- Ensure Next.js route is marked dynamic (no caching) if needed.
- Consider server memory: stop streaming after job completion event.

## Dependencies
- Phase 04 (Redis), Phase 05 (OutputViewer UI placeholder), Phase 07 (agent stream).

## Acceptance criteria
- [ ] SSE endpoint streams historical + live output for a job.
- [ ] Dashboard session detail reflects live logs and status changes without reload.
- [ ] Streams close automatically when job succeeds/fails.

## References
- `tasks/SPEC.MD#Runner`
- `tasks/SPEC.MD#User-Interface`
