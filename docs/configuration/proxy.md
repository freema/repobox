# Proxy Configuration

Repobox supports running behind a corporate proxy for environments where direct internet access is not available.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `HTTP_PROXY` | Proxy URL for HTTP requests | `http://proxy.company.com:8080` |
| `HTTPS_PROXY` | Proxy URL for HTTPS requests | `http://proxy.company.com:8080` |
| `NO_PROXY` | Comma-separated list of hosts to bypass proxy | `gitlab.internal.com,localhost` |

All variables are optional. If not set, direct connections are used.

## Deployment Scenarios

### Scenario A: Everything Behind Corporate Proxy

All external communication (GitHub, GitLab, Google OAuth) goes through proxy.

```env
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1
```

### Scenario B: Hybrid (Internal Git + External Services)

Self-hosted GitLab on internal network, GitHub and OAuth through proxy.

```env
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=gitlab.internal.company.com,localhost,127.0.0.1
```

### Scenario C: No Proxy (Direct Internet)

Simply don't set the proxy variables - Repobox will use direct connections.

## What Uses Proxy

### Web App (Next.js)

| Component | Proxy Support |
|-----------|---------------|
| GitHub API calls | Yes |
| GitLab API calls | Yes |
| GitHub OAuth | Yes |
| Google OAuth | Yes |

### Runner (Go)

| Component | Proxy Support |
|-----------|---------------|
| GitHub PR API | Yes |
| GitLab MR API | Yes |
| Git clone/push | Yes (automatic) |

### Internal Communication

These components do **not** use proxy (and shouldn't):

- Redis communication
- Internal API calls between services

## NO_PROXY Patterns

The `NO_PROXY` variable supports several pattern formats:

| Pattern | Matches |
|---------|---------|
| `gitlab.company.com` | Exact hostname match |
| `.company.com` | All subdomains of company.com |
| `localhost` | localhost and 127.0.0.1 |
| `192.168.1.100` | Specific IP address |

Default value in Docker includes: `localhost,127.0.0.1,redis`

## Docker Configuration

Proxy variables are automatically passed to containers via `docker-compose.dev.yml`:

```yaml
environment:
  - HTTP_PROXY=${HTTP_PROXY:-}
  - HTTPS_PROXY=${HTTPS_PROXY:-}
  - NO_PROXY=${NO_PROXY:-localhost,127.0.0.1,redis}
```

Set the variables in your `.env` file:

```env
# .env
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=gitlab.internal.company.com,localhost,127.0.0.1
```

## Troubleshooting

### Connection Timeouts

If requests timeout, verify:

1. Proxy URL is correct and accessible from containers
2. Proxy allows HTTPS connections to target hosts
3. Authentication (if required) is embedded in URL: `http://user:pass@proxy:8080`

### Self-Signed Certificates

If your proxy uses self-signed certificates, you may need to:

1. Add the CA certificate to the container
2. Or set `NODE_TLS_REJECT_UNAUTHORIZED=0` (not recommended for production)

### Debugging Proxy Configuration

Check if proxy is being used by examining logs:

```bash
# Web app logs
task logs:web

# Runner logs
task logs:runner
```

Look for connection errors or timeout messages that indicate proxy issues.

## Technical Details

### Web App Implementation

The web app uses [undici](https://github.com/nodejs/undici) with `ProxyAgent` for proxy support. Native Node.js `fetch()` does not support proxy environment variables automatically.

Files:
- `apps/web/src/lib/proxy-fetch.ts` - Proxy-aware fetch utility
- `apps/web/src/lib/auth-proxy.ts` - Proxy support for NextAuth OAuth

### Runner Implementation

The Go runner uses `http.ProxyFromEnvironment` which automatically reads standard proxy environment variables.

Files:
- `apps/runner/internal/mergerequest/github.go`
- `apps/runner/internal/mergerequest/gitlab.go`

Git CLI operations (clone, push) automatically respect `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` environment variables.
