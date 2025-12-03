# Phase 08 - Real-time Streaming - Code Review

## Overview

Implementation of Server-Sent Events (SSE) for real-time job output streaming to the dashboard. Users can watch job progress live without page refresh. Relies on Redis output streams produced in Phase 07. Implements `tasks/SPEC.MD#User-Flow` and `#Runner` streaming requirements.

## Files Changed/Added

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/jobs/[id]/stream/route.ts` | SSE endpoint for job output streaming |
| `src/hooks/use-job-stream.ts` | React hook for EventSource subscription |
| `src/hooks/index.ts` | Hooks barrel export |
| `src/components/dashboard/session-detail-client.tsx` | Client component for real-time session detail |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/dashboard/output-viewer.tsx` | Added auto-scroll toggle, connection status, error display |
| `src/components/dashboard/index.ts` | Added SessionDetailClient export |
| `src/app/(dashboard)/sessions/[id]/page.tsx` | Simplified to use SessionDetailClient |

## Implementation Details

### 8.1 SSE Endpoint

**Location:** `src/app/api/jobs/[id]/stream/route.ts`

**Events:**
- `status` - Job status updates with metadata
- `output` - Individual output lines
- `done` - Job completion signal
- `error` - Error messages

**Flow:**
1. Auth check - verify user owns the job
2. Send initial status event
3. Replay existing output lines
4. If job finished, send `done` and close
5. Otherwise, poll Redis every 500ms for new lines and status changes
6. Auto-close after 1 hour max

**Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

### 8.2 useJobStream Hook

**Location:** `src/hooks/use-job-stream.ts`

**Features:**
- SSR hydration support with `initialJob` and `initialOutput`
- Auto-reconnect with configurable delay (default 3s)
- Memory protection with `maxLines` limit (default 10,000)
- Connection state tracking
- Manual reconnect/disconnect methods

**State:**
```typescript
interface JobStreamState {
  status: JobStatus;
  lines: JobOutput[];
  isConnected: boolean;
  isDone: boolean;
  error: string | null;
  metadata: {
    startedAt?: number;
    finishedAt?: number;
    errorMessage?: string;
    linesAdded?: number;
    linesRemoved?: number;
    mrUrl?: string;
    branch?: string;
  };
}
```

### 8.3 OutputViewer Enhancements

**Location:** `src/components/dashboard/output-viewer.tsx`

**New Features:**
- Smart auto-scroll (disables when user scrolls up)
- "Follow output" button to re-enable auto-scroll
- Connection status indicator (green = connected, yellow = reconnecting)
- Error display with retry button
- Streaming indicator with pulsing dot

### 8.4 SessionDetailClient

**Location:** `src/components/dashboard/session-detail-client.tsx`

**Real-time Updates:**
- Status badge updates live
- Metadata (started, finished, duration) updates live
- Output viewer streams new lines
- MR/PR button appears when job succeeds
- Error section appears on failure

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Session Detail Page                          │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │  Server (SSR)   │    │     Client (Hydration)           │   │
│  │                 │    │                                   │   │
│  │  - Auth check   │    │  ┌─────────────────────────────┐ │   │
│  │  - Fetch job    │───▶│  │  SessionDetailClient        │ │   │
│  │  - Initial      │    │  │                             │ │   │
│  │    output       │    │  │  useJobStream hook          │ │   │
│  └─────────────────┘    │  │    ↓                        │ │   │
│                         │  │  EventSource                │ │   │
│                         │  │    ↓                        │ │   │
│                         │  │  /api/jobs/[id]/stream      │ │   │
│                         │  └─────────────────────────────┘ │   │
│                         └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SSE Endpoint                                  │
│                                                                 │
│  1. Auth check                                                  │
│  2. Send status event                                           │
│  3. Replay existing output                                      │
│  4. Poll loop (500ms):                                          │
│     - Check Redis for new lines                                 │
│     - Check job status                                          │
│     - Send events                                               │
│  5. Close on job done or timeout                                │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Redis                                         │
│                                                                 │
│  job:{id}         - Hash with status, metadata                  │
│  job:{id}:output  - List of JSON output lines                   │
└─────────────────────────────────────────────────────────────────┘
```

## SSE Event Format

```
event: status
data: {"status":"running","startedAt":1701561234567}

event: output
data: {"timestamp":1701561234568,"line":"Cloning repository...","stream":"stdout"}

event: output
data: {"timestamp":1701561234569,"line":"Error: something","stream":"stderr"}

event: done
data: {"status":"success"}
```

## Test Results

```
task typecheck - PASSED
task test - PASSED (75 tests)
```

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| SSE endpoint streams historical + live output | ✅ |
| Dashboard session detail reflects live logs | ✅ |
| Status changes without reload | ✅ |
| Streams close automatically when job finishes | ✅ |
| Auto-reconnect on disconnect | ✅ |
| Auto-scroll with manual pause toggle | ✅ |

## Quality Checks

- TypeScript strict mode: ✅
- All tests passing: ✅
- SSR hydration: ✅
- Memory protection (line limit): ✅
- Timeout protection (1 hour max): ✅

## Technical Notes

1. **Polling vs BLPOP**: Used polling (500ms) for simplicity. Redis BLPOP would be more efficient but complicates connection management with Next.js.

2. **SSR + Client Hydration**: Server renders initial state, client takes over with streaming. Prevents flash of empty content.

3. **Auto-scroll UX**: Disables when user scrolls up, re-enables on "Follow output" click or scroll to bottom.

4. **Memory Protection**: Hook limits lines in memory (default 10k). SSE endpoint limits poll time (1 hour).

5. **Error Recovery**: Auto-reconnect after 3s on disconnect. Manual retry button shown on error.

## Dependencies

- Phase 04 (Redis repositories) ✅
- Phase 05 (OutputViewer UI) ✅
- Phase 07 (Agent output streams) ✅

## Future Improvements

- Consider WebSocket for lower latency
- Add BLPOP for more efficient Redis polling
- Add output search/filter
- Add output download as text file

---

*Reviewed: 2024-12-03*
