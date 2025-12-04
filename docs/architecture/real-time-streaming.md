# Real-time Streaming Architecture

## Overview

Repobox provides real-time work session output streaming using Server-Sent Events (SSE). Users can watch AI agent progress live in the dashboard without page refresh.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Go Runner     │────▶│     Redis       │◀────│   Next.js API   │
│                 │     │                 │     │   (SSE Endpoint)│
│  Agent output   │     │  work_session:  │     │                 │
│  RPUSH lines    │     │  {id}:output    │     │  Poll & stream  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         │ SSE
                                                         ▼
                                               ┌─────────────────┐
                                               │   Browser       │
                                               │                 │
                                               │  EventSource    │
                                               │  useWorkSession │
                                               │  Stream         │
                                               └─────────────────┘
```

## Components

### 1. Go Runner (Producer)

The runner streams output to Redis as the AI agent executes:

```go
// Each line is JSON-encoded and pushed to a Redis list
executor.appendOutput(ctx, sessionID, "stdout", "Cloning repository...")
```

**Redis Storage:**
```
Key: work_session:{sessionId}:output
Type: List (RPUSH)
TTL: 24 hours
Format: JSON {"timestamp": 123456789, "line": "...", "stream": "stdout"}
```

Output from all prompts in a session is combined in a single list.

### 2. SSE Endpoint (Bridge)

**Location:** `/api/work-sessions/[id]/stream`

The endpoint:
1. Authenticates the user
2. Sends initial session status
3. Replays existing output lines
4. Polls Redis for new lines (500ms interval)
5. Sends events to client
6. Closes when session reaches terminal state

**Events:**
| Event | Data | Description |
|-------|------|-------------|
| `status` | `{status, jobCount, ...}` | Session status change |
| `output` | `{timestamp, line, stream}` | Output line |
| `done` | `{status}` | Session reached terminal state |
| `error` | `{message}` | Error occurred |

### 3. React Hook (Consumer)

**Location:** `src/hooks/use-work-session-stream.ts`

```typescript
const { status, lines, isConnected, error, reconnect, metadata } =
  useWorkSessionStream(sessionId, {
    initialSession,
    initialOutput,
    maxLines: 10000,
    autoReconnect: true,
  });
```

**Features:**
- SSR hydration support
- Auto-reconnect on disconnect
- Memory protection (line limit)
- Manual reconnect/disconnect
- Session metadata tracking (jobCount, linesAdded, etc.)

**Terminal States:**
- `pushed` - Branch pushed, MR created
- `archived` - Session ended
- `failed` - Error occurred

### 4. OutputViewer (Display)

**Location:** `src/components/dashboard/output-viewer.tsx`

**Features:**
- Terminal-like styling (dark background, monospace)
- stderr in red, stdout in neutral
- Smart auto-scroll (pauses when user scrolls up)
- "Follow output" button
- Connection status indicator

## Data Flow

### Initial Load (SSR)

```
1. Server fetches session from Redis
2. Server fetches existing output
3. Server renders page with initial data
4. Client hydrates with useWorkSessionStream hook
5. Hook connects to SSE if session is not terminal
```

### Live Streaming

```
1. EventSource connects to /api/work-sessions/{id}/stream
2. Endpoint sends initial status + existing output
3. Endpoint enters poll loop:
   - Check for new output lines (LLEN, LRANGE)
   - Check for status change (HGETALL)
   - Send events to client
4. Hook updates React state
5. OutputViewer re-renders with new lines
6. Auto-scroll if enabled
```

### Session Lifecycle

```
1. Session created (initializing)
   → SSE streams clone/setup output

2. Session ready
   → User can submit prompts

3. Prompt submitted (running)
   → SSE streams AI agent output

4. Prompt complete (ready again)
   → User can submit more prompts or push

5. Push requested (running)
   → SSE streams push/MR creation output

6. Push complete (pushed - terminal)
   → SSE sends "done" event
   → Connection closed
```

## Configuration

### SSE Endpoint

| Setting | Value | Description |
|---------|-------|-------------|
| Poll interval | 500ms | Redis check frequency |
| Max poll time | 1 hour | Timeout for long sessions |
| Response buffering | Disabled | Real-time delivery |

### React Hook

| Option | Default | Description |
|--------|---------|-------------|
| `maxLines` | 10000 | Lines kept in memory |
| `autoReconnect` | true | Reconnect on disconnect |
| `reconnectDelay` | 3000ms | Delay before retry |

## Error Handling

### Network Disconnect

1. EventSource fires error event
2. Hook sets `isConnected = false`
3. After delay, hook auto-reconnects
4. UI shows "Reconnecting..." indicator

### Session Errors

1. Runner sets session status to `failed`
2. Runner sets `errorMessage` field
3. SSE sends status event with error
4. UI displays error message in red box

### Stream Timeout

1. SSE endpoint hits 1 hour limit
2. Sends error event with timeout message
3. Closes connection
4. Client can manually reconnect

## Security

- Authentication required for SSE endpoint
- User can only stream their own sessions
- No sensitive data (tokens) in output stream
- Rate limiting via Next.js middleware (if configured)

## Performance

### Memory

- Hook limits lines in state (default 10k)
- Old lines dropped when limit exceeded
- Redis TTL cleans up after 24 hours

### Network

- SSE is efficient (single connection)
- Chunked transfer encoding
- No polling from client side

### Server

- Redis polling is lightweight
- Connection closed when session terminal
- Max 1 hour per connection

## Browser Support

SSE via EventSource is supported in:
- Chrome 6+
- Firefox 6+
- Safari 5+
- Edge 79+

## Alternatives Considered

### WebSocket

Pros: Bi-directional, lower latency
Cons: More complex, needs separate server

**Decision:** SSE is simpler and sufficient for our read-only use case.

### Long Polling

Pros: Works everywhere
Cons: Higher latency, more requests

**Decision:** SSE provides better UX with single connection.

### Redis Pub/Sub

Pros: Real-time delivery
Cons: Complexity, connection management in serverless

**Decision:** Redis List polling is simpler and works well with Next.js.

## Troubleshooting

### Stream Not Connecting

1. Check browser DevTools Network tab for SSE connection
2. Verify auth cookie is present
3. Check server logs for errors

### Output Not Updating

1. Verify runner is pushing to correct Redis key
2. Check Redis with `LRANGE work_session:{id}:output 0 -1`
3. Verify SSE events in DevTools

### High Memory Usage

1. Reduce `maxLines` option in hook
2. Check for memory leaks in components
3. Verify old lines are being trimmed
