FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install git for go mod download
RUN apk add --no-cache git

# Copy go.mod first
COPY go.mod ./

# Copy source code
COPY . .

# Download dependencies and generate go.sum
RUN go mod tidy

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -o /runner ./cmd/runner

# Runtime image
FROM alpine:3.20

# Install git, certificates, Node.js and npm for Claude CLI
RUN apk add --no-cache git ca-certificates nodejs npm

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

COPY --from=builder /runner /usr/local/bin/runner

ENTRYPOINT ["runner"]
