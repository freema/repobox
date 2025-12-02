# Phase 07 - AI Agent Integration

## Overview
Integrate Claude Code (or compatible CLI) with the runner so jobs trigger AI-driven code changes. Focus on process management, streaming output, and error handling. Aligns with `tasks/SPEC.MD#Runner` (AI Agent) and `#Environments`.

## Objectives
- Spawn Claude Code CLI (or fallback agent) with prompt + repo context.
- Stream stdout/stderr in real time to Redis output streams.
- Handle timeouts, exit codes, and descriptive failure messages.
- Support per-job environment selection (Default, PHP, Python, etc. - initial metadata only).

## Deliverables
- `internal/agent/claude.go` implementing `Execute` with streaming helper.
- Integration glue in runner executor hooking before git commit/push.
- Redis output writing logic (shared with Phase 08 SSE consumer).
- Configuration for AI provider (ANTHROPIC_API_KEY, CLI path, timeout).

## Work items
### 7.1 Agent wrapper
- [ ] Command builder supporting args `--print --output-format text`.
- [ ] Context timeouts and cancellation handling.
- [ ] Stdout/stderr scanners pushing to Redis (`job:{id}:output`).

### 7.2 Working directory
- [ ] Clone + checkout handled in Phase 06; ensure agent receives repo root.
- [ ] Optional environment hooks (pre-run script) tied to job environment selection.

### 7.3 Output streaming
- [ ] Reuse Redis helper to XADD lines with timestamp + stream type.
- [ ] Ensure large outputs chunked safely (scanner buffer increase if needed).

### 7.4 Error handling
- [ ] Distinguish timeout vs non-zero exit vs internal error.
- [ ] Bubble meaningful error back to job status (`errorMessage`).

## Technical notes
- Keep agent interface abstract to allow future providers (Codex, custom) as per spec Non-Goals.
- Consider log prefixing (`stdout`, `stderr`) for SSE consumer styling.
- Add configuration to disable agent for dry-run/testing.

## Dependencies
- Phase 06 runner core, Phase 04 Redis streams, Phase 05 output UI placeholder.

## Acceptance criteria
- [ ] Runner spawns agent, captures output, and job status reflects success/failure.
- [ ] Redis output stream receives real-time lines.
- [ ] Timeouts produce clear failure message and cleanup occurs.

## References
- `tasks/SPEC.MD#Runner`
- `tasks/SPEC.MD#Environments`
