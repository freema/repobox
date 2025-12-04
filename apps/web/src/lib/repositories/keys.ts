/**
 * Redis key patterns per SPEC.MD#Data-Model
 * Centralized key management for all Redis operations
 */
export const REDIS_KEYS = {
  // User keys
  user: (userId: string) => `user:${userId}`,

  // Auth Session keys (for login sessions)
  session: (sessionId: string) => `session:${sessionId}`,

  // Git Provider keys
  gitProvider: (userId: string, providerId: string) => `git_provider:${userId}:${providerId}`,
  userGitProviders: (userId: string) => `git_providers:${userId}`,
  repoCache: (userId: string, providerId: string) => `repos_cache:${userId}:${providerId}`,

  // Job keys
  job: (jobId: string) => `job:${jobId}`,
  jobOutput: (jobId: string) => `job:${jobId}:output`,
  userJobs: (userId: string) => `jobs:user:${userId}`,

  // Job queue stream (legacy single-shot jobs)
  jobsStream: "jobs:stream",
  jobsConsumerGroup: "jobs:stream:runners",

  // Work Session keys (for iterative AI work on repositories)
  workSession: (sessionId: string) => `work_session:${sessionId}`,
  workSessionOutput: (sessionId: string) => `work_session:${sessionId}:output`,
  workSessionJobs: (sessionId: string) => `work_session:${sessionId}:jobs`,
  userWorkSessions: (userId: string) => `work_sessions:user:${userId}`,

  // Work Session streams
  workSessionsInitStream: "work_sessions:init:stream",
  workSessionsInitConsumerGroup: "work_sessions:init:runners",
  workSessionsJobsStream: "work_sessions:jobs:stream",
  workSessionsJobsConsumerGroup: "work_sessions:jobs:runners",
  workSessionsPushStream: "work_sessions:push:stream",
  workSessionsPushConsumerGroup: "work_sessions:push:runners",
} as const;

// TTL values in seconds
export const TTL = {
  session: 7 * 24 * 60 * 60, // 7 days (auth session)
  repoCache: 5 * 60, // 5 minutes
  jobOutput: 24 * 60 * 60, // 24 hours
  workSessionOutput: 7 * 24 * 60 * 60, // 7 days
  workSession: 30 * 24 * 60 * 60, // 30 days (metadata only)
} as const;
