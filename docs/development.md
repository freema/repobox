# Development Guide

## Prerequisites

- Docker & Docker Compose
- [Task](https://taskfile.dev) (go-task)
- Git

**Note:** Node.js and Go are NOT needed locally - everything runs in Docker.

## Quick Start

```bash
# Clone repo
git clone <repo-url>
cd repobox

# Copy env file
cp .env.example .env
# Edit .env with your values

# Start all services
task dev

# Or in background
task dev:bg
```

## Task Commands

```bash
task              # List all commands
task dev          # Start all (Redis + Web + Runner)
task dev:web      # Start Redis + Web only
task dev:runner   # Start Redis + Runner only
task dev:bg       # Start all in background
task stop         # Stop all containers
task clean        # Stop and remove volumes
task build        # Build all services
task build:runner # Rebuild Go runner
task logs         # All logs
task logs:web     # Web logs only
task logs:runner  # Runner logs only
task ps           # Show running containers
task check        # Run lint + typecheck + tests
```

## Project Structure

```
repobox/
├── apps/
│   ├── web/              # Next.js web app
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/
│   │   │   ├── lib/      # Utilities, repositories
│   │   │   └── types/
│   │   └── package.json
│   └── runner/           # Go runner
│       ├── cmd/runner/   # Entry point
│       └── internal/     # Internal packages
├── packages/
│   └── types/            # Shared TypeScript types
├── docker/
│   └── docker-compose.dev.yml
├── docs/                 # Documentation
├── tasks/                # Implementation plans
├── Taskfile.yml          # Task runner
└── .env                  # Environment config
```

## Web App Development

Web runs in Docker with hot reload:

```bash
task dev:web
# Open http://localhost:3000
```

### Adding Dependencies

```bash
task pnpm -- add <package>
task pnpm -- add -D <dev-package>
```

### Running Commands

```bash
task pnpm -- <command>
task sh  # Shell in web container
```

## Runner Development

Runner must be rebuilt after changes:

```bash
# Make changes to apps/runner/

# Rebuild
task build:runner

# Restart
task stop && task dev:runner
```

### Running Tests

```bash
# In Docker
docker run --rm -v "$(pwd)/apps/runner":/app -w /app golang:1.23-alpine go test ./...
```

## Database (Redis)

Access Redis CLI:

```bash
docker exec -it repobox-redis redis-cli
```

Common commands:

```bash
KEYS *                    # List all keys
HGETALL job:<id>          # Get job
XLEN jobs:stream          # Queue length
XINFO GROUPS jobs:stream  # Consumer groups
```

## Debugging

### Web App Logs

```bash
task logs:web
# Or in real-time
docker logs -f repobox-web
```

### Runner Logs

```bash
task logs:runner
docker logs -f repobox-runner
```

### Check Container Status

```bash
task ps
docker ps -a
```

## Testing Auth Locally

1. Create GitHub OAuth App:
   - Homepage: `http://localhost:3000`
   - Callback: `http://localhost:3000/api/auth/callback/github`

2. Add to `.env`:
   ```
   GITHUB_OAUTH_CLIENT_ID=<id>
   GITHUB_OAUTH_CLIENT_SECRET=<secret>
   ```

3. Restart: `task stop && task dev`

## Common Issues

### Port Already in Use

```bash
task stop
# Or kill specific port
lsof -ti:3000 | xargs kill -9
```

### node_modules Issues

```bash
task clean
task dev
```

### Runner Not Connecting

Check Redis URL in docker-compose - should be `redis://redis:6379` (Docker network).

### Build Fails

```bash
# Clean rebuild
task clean
task build
task dev
```
