# Contributing to Repobox

Thank you for your interest in contributing to Repobox! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Docker and Docker Compose
- [Task](https://taskfile.dev/) (go-task)
- Git

### Getting Started

1. Fork and clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `task dev` to start all services

### Development Workflow

All commands run through Docker - never install dependencies locally.

```bash
# Start development
task dev

# Run code quality checks
task check

# View logs
task logs
```

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow existing code patterns
- Run `task lint` before committing
- Run `task typecheck` to verify types

### Go

- Follow standard Go conventions
- Use `gofmt` for formatting
- Run tests with `go test ./...`

## Testing

### Running Tests

```bash
# All tests
task test

# Web tests only
task pnpm -- test:run

# Runner tests only (in Docker)
docker exec repobox-runner go test ./...
```

### Writing Tests

- Write unit tests for new functionality
- Place test files next to source files
- Use descriptive test names

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run `task check` to verify everything passes
4. Commit with clear, descriptive messages
5. Push and create a Pull Request
6. Wait for CI checks to pass
7. Request review

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Keep first line under 72 characters
- Reference issues when applicable

### PR Guidelines

- Keep PRs focused and reasonably sized
- Update documentation if needed
- Add tests for new functionality
- Ensure CI passes

## Project Structure

```
repobox/
├── apps/
│   ├── web/          # Next.js frontend
│   └── runner/       # Go backend
├── packages/
│   └── types/        # Shared types
├── docker/           # Docker configs
└── tasks/            # Implementation plans
```

## Questions?

Open an issue for questions or discussions about contributing.
