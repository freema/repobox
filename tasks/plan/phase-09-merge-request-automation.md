# Phase 09 - Merge/Pull Request Automation

## Overview
Automatically create GitLab Merge Requests or GitHub Pull Requests when a job succeeds, then surface the link in the UI. Aligns with `tasks/SPEC.MD#Runner` and `#Git-Providers`.

## Objectives
- GitLab and GitHub API clients for MR/PR creation with meaningful titles/descriptions.
- Runner hook invoked after push to call appropriate client and store URL in job hash.
- UI updates showing MR/PR link in session detail + card.
- Error handling/fallback when MR/PR creation fails (job should still succeed but show warning).

## Deliverables
- `internal/git/gitlab_client.go`, `internal/git/github_client.go` (or shared package) with CreateMergeRequest/CreatePullRequest.
- Description generator summarizing prompt and diff stats (`linesAdded`, `linesRemoved`).
- Runner integration writing `mrUrl` (or `prUrl`) to Redis.
- UI components linking to MR/PR with status indicator.

## Work items
### 9.1 GitLab MR client
- [ ] POST `/api/v4/projects/:id/merge_requests` with source/target branch, title, description.
- [ ] Support self-hosted base URL stored on provider record.

### 9.2 GitHub PR client
- [ ] POST `/repos/:owner/:repo/pulls` with head/base, title, body.
- [ ] Accept enterprise host override if needed.

### 9.3 Templates
- [ ] Generate title from prompt (truncate) and default target branch (main/master detection).
- [ ] Description template including prompt, summary, diff stats, Repobox signature.

### 9.4 Runner integration
- [ ] After push, call provider-specific client, capture URL, store on job hash.
- [ ] If API call fails, mark job as success but attach warning/error field.

### 9.5 UI integration
- [ ] Session cards show MR/PR icon + link if available.
- [ ] Session detail contains CTA button to open MR/PR.

## Technical notes
- Respect rate limits: implement retry with backoff for status 429/5xx.
- Ensure tokens include required scopes (validated in Phase 03 verification step).
- Use provider metadata to derive project ID / repo owner automatically.

## Dependencies
- Phase 06 (runner) and Phase 03 (provider metadata) plus Phase 05 UI.

## Acceptance criteria
- [ ] Successful job results in MR/PR automatically for both GitLab and GitHub providers.
- [ ] Job record stores MR/PR URL and any failure reason.
- [ ] UI displays link; failure states show warning tooltip/message.

## References
- `tasks/SPEC.MD#Git-Providers`
- `tasks/SPEC.MD#Runner`
