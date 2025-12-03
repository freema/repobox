# Repobox

Repobox is an open-source, self-hosted alternative to Claude Code Web. It allows developers and teams to run AI-powered code agents in isolated containers that can clone repositories, make changes, and create merge requests automatically.

## Features

- **Multi-provider Git Support**: Connect GitHub and GitLab (including self-hosted instances)
- **AI-Powered Code Agent**: Uses Claude Code CLI for intelligent code modifications
- **Real-time Output Streaming**: Watch job progress with SSE-based live output
- **Automatic MR/PR Creation**: Creates merge/pull requests after successful jobs
- **Secure Token Handling**: AES-256-GCM encryption for all access tokens
- **OAuth Authentication**: Sign in with GitHub or Google

## Architecture

```
repobox/
├── apps/
│   ├── web/          # Next.js 15 + React 19 + Tailwind 4
│   └── runner/       # Go 1.23 job executor
├── packages/
│   └── types/        # Shared TypeScript types
└── docker/           # Docker compose configurations
```

### Components

- **Web App**: Dashboard for managing git providers, creating jobs, and viewing results
- **Runner**: Go service that processes jobs from Redis queue, clones repos, runs Claude Code CLI, and creates MRs
- **Redis**: Message queue and data persistence

## Getting Started

### Prerequisites

- Docker and Docker Compose
- [Task](https://taskfile.dev/) (go-task) - for running development commands
- Anthropic API key (for Claude Code CLI)

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/repobox.git
   cd repobox
   ```

2. Copy environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Start development environment:
   ```bash
   task dev
   ```

4. Open http://localhost:3000 in your browser

### Environment Variables

#### Required

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | NextAuth secret (generate with `openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | 32-byte key for token encryption (hex or base64) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude |

#### OAuth Providers (at least one required)

| Variable | Description |
|----------|-------------|
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Secret |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |

#### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `NEXTAUTH_URL` | `http://localhost:3000` | Base URL for auth callbacks |
| `CLAUDE_CLI_PATH` | `claude` | Path to Claude Code CLI |
| `AGENT_ENABLED` | `true` | Enable/disable real agent (mock mode if false) |

## Development

All development commands use `task` (go-task). Run `task` to see available commands.

### Common Commands

```bash
# Start all services
task dev

# Start specific services
task dev:web      # Web app only
task dev:runner   # Runner only

# Building
task build        # Build all
task build:runner # Rebuild Go runner

# Logs
task logs         # All logs
task logs:web     # Web logs
task logs:runner  # Runner logs

# Code quality
task lint         # Run linting
task typecheck    # TypeScript check
task test         # Run tests
task check        # Run all checks

# Utilities
task pnpm -- <command>  # Run pnpm in web container
task sh                 # Shell into web container
task ps                 # Show running containers
task stop               # Stop all services
task clean              # Stop and remove volumes
```

### Running Commands in Docker

Everything runs in Docker - never install dependencies locally:

```bash
# Install a package
task pnpm -- add some-package

# Run any pnpm command
task pnpm -- <command>
```

## Project Structure

### Web App (`apps/web/`)

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS 4
- **Auth**: NextAuth.js v5
- **Database**: Redis (via ioredis)

Key directories:
- `src/app/` - Next.js routes and pages
- `src/components/` - React components
- `src/lib/` - Utilities, repositories, providers

### Runner (`apps/runner/`)

- **Language**: Go 1.23
- **Queue**: Redis-based job queue
- **Agent**: Claude Code CLI wrapper

Key packages:
- `internal/agent/` - Claude Code integration
- `internal/git/` - Git operations
- `internal/crypto/` - Token decryption
- `internal/queue/` - Redis queue consumer

## Security

- All git provider tokens are encrypted with AES-256-GCM before storage
- Sessions use secure, HTTP-only cookies
- OAuth state is validated to prevent CSRF
- Tokens are masked in logs and error messages

## API Reference

### Jobs API

- `POST /api/jobs` - Create a new job
- `GET /api/jobs` - List user's jobs
- `GET /api/jobs/[id]` - Get job details
- `GET /api/jobs/[id]/stream` - SSE stream for real-time output

### Git Providers API

- `POST /api/git-providers` - Add a provider
- `GET /api/git-providers` - List providers
- `GET /api/git-providers/[id]` - Get provider
- `DELETE /api/git-providers/[id]` - Remove provider
- `POST /api/git-providers/[id]/verify` - Verify token

### Repositories API

- `GET /api/repositories` - List repositories from all providers

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests and linting (`task check`)
4. Commit your changes
5. Push to your branch and create a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Author

Created by [Tomas Grasl](https://www.tomasgrasl.cz/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
