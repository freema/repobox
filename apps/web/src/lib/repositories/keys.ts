/**
 * Redis key patterns per SPEC.MD#Data-Model
 * Centralized key management for all Redis operations
 */
export const REDIS_KEYS = {
  // User keys
  user: (userId: string) => `user:${userId}`,

  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,

  // Git Provider keys
  gitProvider: (userId: string, providerId: string) => `git_provider:${userId}:${providerId}`,
  userGitProviders: (userId: string) => `git_providers:${userId}`,
  repoCache: (userId: string, providerId: string) => `repos_cache:${userId}:${providerId}`,

  // Job keys
  job: (jobId: string) => `job:${jobId}`,
  jobOutput: (jobId: string) => `job:${jobId}:output`,
  userJobs: (userId: string) => `jobs:user:${userId}`,

  // Job queue stream
  jobsStream: "jobs:stream",
  jobsConsumerGroup: "jobs:stream:runners",
} as const;

// TTL values in seconds
export const TTL = {
  session: 7 * 24 * 60 * 60, // 7 days
  repoCache: 5 * 60, // 5 minutes
  jobOutput: 24 * 60 * 60, // 24 hours
} as const;
