# Phase 09 - Merge/Pull Request Automation - Code Review

## Implementation Summary

Phase 09 adds automatic MR/PR creation after successful job completion, integrating with both GitLab and GitHub APIs.

## Files Changed

### Go Runner - New Files
- `apps/runner/internal/mergerequest/types.go` - Types and interfaces for MR/PR creation
- `apps/runner/internal/mergerequest/gitlab.go` - GitLab MR client
- `apps/runner/internal/mergerequest/github.go` - GitHub PR client
- `apps/runner/internal/mergerequest/template.go` - Title/description generator
- `apps/runner/internal/mergerequest/utils.go` - Helper utilities

### Go Runner - Modified Files
- `apps/runner/internal/executor/executor.go` - Integration of MR/PR creation after push

### Web App - Modified Files
- `packages/types/src/index.ts` - Added `mrWarning` field to Job type
- `apps/web/src/lib/repositories/job.ts` - Added `mrWarning` to schema
- `apps/web/src/hooks/use-job-stream.ts` - Added `mrWarning` to metadata
- `apps/web/src/components/dashboard/session-detail-client.tsx` - MR warning display + Link fix

## Review Checklist

### Architecture
- [ ] MR/PR clients properly separated for GitLab and GitHub
- [ ] Error handling allows job to succeed even if MR creation fails
- [ ] Provider type detection works correctly from Redis data

### API Integration
- [ ] GitLab API: POST `/api/v4/projects/:id/merge_requests`
- [ ] GitHub API: POST `/repos/:owner/:repo/pulls`
- [ ] Proper authentication headers for both providers
- [ ] Support for self-hosted/enterprise instances

### Template Generation
- [ ] Title truncation to 72 chars
- [ ] Description includes prompt, diff stats, signature
- [ ] Clean formatting in markdown

### UI Integration
- [ ] `mrUrl` displayed in session cards
- [ ] `mrWarning` shown as yellow banner when MR creation fails
- [ ] Real-time updates via SSE stream

### Error Handling
- [ ] Job succeeds even if MR creation fails
- [ ] Warning message stored in `mrWarning` field
- [ ] Errors logged properly

## Testing Notes

To test MR/PR creation:
1. Configure a Git provider (GitHub or GitLab)
2. Run a job on a repository
3. Verify MR/PR is created after push
4. Check UI shows MR link or warning

## Known Limitations

- No retry logic for rate limiting (429 responses)
- Default branch detection is basic (returns "main")
- No duplicate MR detection
