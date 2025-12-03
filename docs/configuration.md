# Configuration Reference

All configuration is done via environment variables. Copy `.env.example` to `.env` and fill in values.

## Web App

### Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_OAUTH_CLIENT_ID` | For GitHub auth | GitHub OAuth app ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | For GitHub auth | GitHub OAuth app secret |
| `GOOGLE_OAUTH_CLIENT_ID` | For Google auth | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For Google auth | Google OAuth secret |
| `LDAP_URL` | For LDAP auth | LDAP server URL |
| `LDAP_BIND_DN` | For LDAP auth | Bind DN for LDAP |
| `LDAP_BIND_PASSWORD` | For LDAP auth | Bind password |
| `LDAP_SEARCH_BASE` | For LDAP auth | User search base |
| `LDAP_USER_FILTER` | For LDAP auth | User filter template |

### Session & Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | Yes | - | Secret for session signing |
| `SESSION_MAX_AGE` | No | `604800` | Session duration (seconds, 7 days) |
| `ENCRYPTION_KEY` | Yes | - | 32-byte key for AES-256-GCM |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |

### App

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public app URL |

## Go Runner

### Core Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection |
| `ENCRYPTION_KEY` | Yes | - | Must match web app |
| `RUNNER_ID` | No | `runner-1` | Unique runner ID |
| `MAX_CONCURRENT_JOBS` | No | `10` | Worker pool size |
| `MAX_JOBS_PER_USER` | No | `3` | Per-user job limit |
| `JOB_TIMEOUT` | No | `3600` | Job timeout (seconds) |
| `TEMP_DIR` | No | `/tmp/repobox` | Git clone directory |

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | No | `json` | Log format: `json` (production), `text` (development) |

### Git Commit Identity

Commits created by the runner use this identity:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GIT_AUTHOR_NAME` | No | `Repobox Bot` | Git commit author name |
| `GIT_AUTHOR_EMAIL` | No | `bot@repobox.cloud` | Git commit author email |

### Temp Directory Cleanup

Runner automatically cleans up cloned repositories to prevent disk overflow:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLEANUP_AFTER_JOB` | No | `true` | Delete job directory after completion |
| `CLEANUP_ON_STARTUP` | No | `true` | Clean all temp files when runner starts |
| `CLEANUP_INTERVAL_MINUTES` | No | `30` | Periodic cleanup interval |
| `CLEANUP_MAX_AGE_MINUTES` | No | `120` | Delete directories older than this |
| `CLEANUP_MAX_DISK_MB` | No | `0` | Max disk usage in MB (0 = unlimited) |

**Cleanup behavior:**
- **Startup cleanup**: Removes all orphaned directories from previous crashes
- **Periodic cleanup**: Every 30 minutes, removes directories older than 2 hours
- **Disk limit**: When set, removes oldest directories until under limit

## AI Agent

Configuration for the AI code agent that executes prompts in repositories.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_ENABLED` | No | `true` | Enable AI agent (false = mock mode) |
| `AI_PROVIDER` | No | `claude` | AI provider name |
| `AI_CLI_PATH` | No | `claude` | Path to CLI executable |
| `ANTHROPIC_API_KEY` | For Claude | - | Claude API key |
| `AI_TIMEOUT` | No | `1800` | Agent timeout in seconds (30 min) |
| `AI_MAX_OUTPUT_LINES` | No | `10000` | Max output lines before truncation |

### Mock Mode

If `AI_ENABLED=false` or `ANTHROPIC_API_KEY` is empty, the runner operates in mock mode:
- Creates a `.repobox-mock.md` file instead of running AI
- Useful for testing the pipeline without AI costs
- All git operations (clone, branch, commit, push) still execute

### Claude Code Setup

1. Install Claude Code CLI: https://docs.anthropic.com/claude-code
2. Get API key from https://console.anthropic.com/
3. Set `ANTHROPIC_API_KEY` in `.env`

The runner invokes Claude with:
```bash
claude --print --output-format text -p "<user prompt>"
```

## Generating Keys

### Encryption Key (32 bytes)

```bash
# Hex format (64 chars)
openssl rand -hex 32

# Base64 format (44 chars)
openssl rand -base64 32
```

### Session Secret

```bash
openssl rand -base64 32
```

## Docker Override

In `docker-compose.dev.yml`, the runner uses:

```yaml
environment:
  - REDIS_URL=redis://redis:6379  # Internal Docker network
```

This overrides `.env` for container networking.
