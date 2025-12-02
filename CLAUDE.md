# Repobox Development Guidelines

## Development Environment Rules

### CRITICAL: Everything runs in Docker - NO local installs!

- **NEVER install Go locally** - Go runner runs in Docker container
- **NEVER install Node.js dependencies locally** - Web app runs in Docker container
- **NEVER run `pnpm install` or `npm install` locally** - Use Docker instead
- **NEVER run `brew install go`** - Go is Docker only

## Task Commands (gotask)

All development commands use `task` (go-task). Run `task` to see all available commands.

### Starting Development

```bash
task dev          # Start all (Redis + Web + Runner)
task dev:web      # Start Redis + Web only
task dev:runner   # Start Redis + Runner only
task dev:bg       # Start all in background
```

### Stopping

```bash
task stop         # Stop all containers
task clean        # Stop and remove volumes (clean slate)
```

### Building

```bash
task build        # Build all services
task build:runner # Rebuild Go runner after code changes
```

### Logs

```bash
task logs         # All logs
task logs:web     # Web logs only
task logs:runner  # Runner logs only
```

### Running Commands

```bash
task pnpm -- install           # Run pnpm command
task pnpm -- add some-package  # Add package
task sh                        # Shell in web container
```

### Code Quality

```bash
task lint         # Run linting
task typecheck    # TypeScript check
task test         # Run tests
```

### Status

```bash
task ps           # Show running containers
```

## How It Works

- **Web app**: Node 20 container with project bind-mounted
- **node_modules**: Created inside container but visible locally for IDE autocomplete
- **Runner**: Go binary built in container
- **Redis**: Standard Redis 7 Alpine image

## Project Structure

```
repobox/
├── apps/
│   ├── web/          # Next.js 15 + React 19 + Tailwind 4 (Docker)
│   └── runner/       # Go 1.23 (Docker)
├── packages/
│   └── types/        # Shared TypeScript types
├── docker/
│   └── docker-compose.dev.yml
├── Taskfile.yml      # Task runner commands
└── tasks/            # Implementation plans
```
