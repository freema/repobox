package worker

import (
	"context"
	"errors"
	"log/slog"
	"sync"

	"github.com/repobox/runner/internal/job"
)

// ErrPoolStopped is returned when submitting to a stopped pool
var ErrPoolStopped = errors.New("worker pool is stopped")

// JobMessage represents a job from Redis stream
type JobMessage struct {
	StreamID   string   // Redis stream message ID for ACK
	Job        *job.Job // Parsed job data
	ProviderID string   // For fetching token
}

// JobHandler processes a single job
type JobHandler func(ctx context.Context, msg *JobMessage) error

// Pool manages a pool of worker goroutines
type Pool struct {
	size    int
	jobs    chan *JobMessage
	handler JobHandler
	wg      sync.WaitGroup
	logger  *slog.Logger
	mu      sync.RWMutex
	stopped bool
}

// NewPool creates a new worker pool
func NewPool(size int, handler JobHandler, logger *slog.Logger) *Pool {
	return &Pool{
		size:    size,
		jobs:    make(chan *JobMessage, size*2), // Buffer for smooth flow
		handler: handler,
		logger:  logger,
	}
}

// Start launches all workers
func (p *Pool) Start(ctx context.Context) {
	for i := 0; i < p.size; i++ {
		p.wg.Add(1)
		go p.worker(ctx, i)
	}
	p.logger.Info("worker pool started", "workers", p.size)
}

// Submit adds a job to the queue. Returns ErrPoolStopped if pool is stopped.
func (p *Pool) Submit(msg *JobMessage) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.stopped {
		return ErrPoolStopped
	}
	p.jobs <- msg
	return nil
}

// Stop gracefully shuts down the pool
func (p *Pool) Stop() {
	p.mu.Lock()
	p.stopped = true
	p.mu.Unlock()

	close(p.jobs)
	p.wg.Wait()
	p.logger.Info("worker pool stopped")
}

// worker is a single worker goroutine
func (p *Pool) worker(ctx context.Context, id int) {
	defer p.wg.Done()

	logger := p.logger.With("worker_id", id)
	logger.Debug("worker started")

	for {
		select {
		case <-ctx.Done():
			// Context cancelled - drain remaining jobs before exiting
			logger.Info("worker draining remaining jobs before shutdown")
			for msg := range p.jobs {
				p.processJob(ctx, logger, msg)
			}
			logger.Debug("worker finished draining")
			return
		case msg, ok := <-p.jobs:
			if !ok {
				// Channel closed, exit
				logger.Debug("worker finished")
				return
			}
			p.processJob(ctx, logger, msg)
		}
	}
}

// processJob handles a single job execution
func (p *Pool) processJob(ctx context.Context, logger *slog.Logger, msg *JobMessage) {
	jobLogger := logger.With("job_id", msg.Job.ID, "user_id", msg.Job.UserID)
	jobLogger.Info("processing job")

	if err := p.handler(ctx, msg); err != nil {
		jobLogger.Error("job failed", "error", err)
	} else {
		jobLogger.Info("job completed")
	}
}

// JobsChannel returns the jobs channel for the consumer
func (p *Pool) JobsChannel() chan<- *JobMessage {
	return p.jobs
}

// QueueSize returns current number of queued jobs
func (p *Pool) QueueSize() int {
	return len(p.jobs)
}
