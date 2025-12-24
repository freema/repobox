import { redis } from "../redis";
import { REDIS_KEYS, TTL } from "./keys";
import { toHash, fromHash, type FieldSchema } from "./serialization";
import type { WorkSession, WorkSessionStatus, JobOutput } from "@repobox/types";

const WORK_SESSION_SCHEMA: FieldSchema = {
  id: "string",
  userId: "string",
  providerId: "string",
  repoUrl: "string",
  repoName: "string",
  baseBranch: "string",
  workBranch: "string",
  status: "string",
  mrUrl: "optional_string",
  mrWarning: "optional_string",
  errorMessage: "optional_string",
  lastJobStatus: "optional_string",
  totalLinesAdded: "number",
  totalLinesRemoved: "number",
  jobCount: "number",
  lastActivityAt: "number",
  createdAt: "number",
  pushedAt: "optional_number",
};

/**
 * Creates a new work session
 */
export async function createWorkSession(session: WorkSession): Promise<WorkSession> {
  const sessionKey = REDIS_KEYS.workSession(session.id);
  const userSessionsKey = REDIS_KEYS.userWorkSessions(session.userId);

  const pipeline = redis.pipeline();

  // Store session hash
  pipeline.hset(sessionKey, toHash(session));
  pipeline.expire(sessionKey, TTL.workSession);

  // Add to user's sessions sorted set (score = createdAt for time-based sorting)
  pipeline.zadd(userSessionsKey, session.createdAt, session.id);

  await pipeline.exec();

  return session;
}

/**
 * Gets a work session by ID
 */
export async function getWorkSession(sessionId: string): Promise<WorkSession | null> {
  const key = REDIS_KEYS.workSession(sessionId);
  const data = await redis.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return fromHash<WorkSession>(data, WORK_SESSION_SCHEMA);
}

/**
 * Updates work session status and optional fields
 */
export async function updateWorkSessionStatus(
  sessionId: string,
  status: WorkSessionStatus,
  additionalFields?: {
    mrUrl?: string;
    mrWarning?: string;
    errorMessage?: string;
    totalLinesAdded?: number;
    totalLinesRemoved?: number;
    jobCount?: number;
    pushedAt?: number;
  }
): Promise<void> {
  const key = REDIS_KEYS.workSession(sessionId);

  const updates: Record<string, string> = {
    status,
    last_activity_at: String(Date.now()),
  };

  if (additionalFields) {
    if (additionalFields.mrUrl !== undefined) {
      updates.mr_url = additionalFields.mrUrl;
    }
    if (additionalFields.mrWarning !== undefined) {
      updates.mr_warning = additionalFields.mrWarning;
    }
    if (additionalFields.errorMessage !== undefined) {
      updates.error_message = additionalFields.errorMessage;
    }
    if (additionalFields.totalLinesAdded !== undefined) {
      updates.total_lines_added = String(additionalFields.totalLinesAdded);
    }
    if (additionalFields.totalLinesRemoved !== undefined) {
      updates.total_lines_removed = String(additionalFields.totalLinesRemoved);
    }
    if (additionalFields.jobCount !== undefined) {
      updates.job_count = String(additionalFields.jobCount);
    }
    if (additionalFields.pushedAt !== undefined) {
      updates.pushed_at = String(additionalFields.pushedAt);
    }
  }

  await redis.hset(key, updates);
}

/**
 * Touches work session (updates lastActivityAt)
 */
export async function touchWorkSession(sessionId: string): Promise<void> {
  const key = REDIS_KEYS.workSession(sessionId);
  await redis.hset(key, "last_activity_at", String(Date.now()));
}

/**
 * Gets work sessions for a user with pagination
 */
export async function getUserWorkSessions(
  userId: string,
  options: { offset?: number; limit?: number; excludeArchived?: boolean } = {}
): Promise<WorkSession[]> {
  const { offset = 0, limit = 50, excludeArchived = true } = options;
  const userSessionsKey = REDIS_KEYS.userWorkSessions(userId);

  // Get session IDs from sorted set (reverse order for newest first)
  const sessionIds = await redis.zrevrange(userSessionsKey, offset, offset + limit - 1);

  if (sessionIds.length === 0) {
    return [];
  }

  // Batch fetch sessions using pipeline
  const pipeline = redis.pipeline();
  for (const sessionId of sessionIds) {
    pipeline.hgetall(REDIS_KEYS.workSession(sessionId));
  }

  const results = await pipeline.exec();
  const sessions: WorkSession[] = [];

  for (const result of results || []) {
    if (result && result[1] && typeof result[1] === "object") {
      const data = result[1] as Record<string, string>;
      if (Object.keys(data).length > 0) {
        const session = fromHash<WorkSession>(data, WORK_SESSION_SCHEMA);
        if (!excludeArchived || session.status !== "archived") {
          sessions.push(session);
        }
      }
    }
  }

  return sessions;
}

/**
 * Gets total work session count for a user
 */
export async function getUserWorkSessionCount(userId: string): Promise<number> {
  const userSessionsKey = REDIS_KEYS.userWorkSessions(userId);
  return redis.zcard(userSessionsKey);
}

/**
 * Adds a job ID to work session's job list
 */
export async function addJobToWorkSession(sessionId: string, jobId: string): Promise<void> {
  const key = REDIS_KEYS.workSessionJobs(sessionId);
  await redis.rpush(key, jobId);
}

/**
 * Gets all job IDs in a work session
 */
export async function getWorkSessionJobIds(sessionId: string): Promise<string[]> {
  const key = REDIS_KEYS.workSessionJobs(sessionId);
  return redis.lrange(key, 0, -1);
}

/**
 * Deletes a work session and its associated data
 */
export async function deleteWorkSession(sessionId: string): Promise<boolean> {
  const session = await getWorkSession(sessionId);
  if (!session) {
    return false;
  }

  const sessionKey = REDIS_KEYS.workSession(sessionId);
  const userSessionsKey = REDIS_KEYS.userWorkSessions(session.userId);
  const outputKey = REDIS_KEYS.workSessionOutput(sessionId);
  const jobsKey = REDIS_KEYS.workSessionJobs(sessionId);

  const pipeline = redis.pipeline();
  pipeline.del(sessionKey);
  pipeline.zrem(userSessionsKey, sessionId);
  pipeline.del(outputKey);
  pipeline.del(jobsKey);
  await pipeline.exec();

  return true;
}

/**
 * Generates a unique work session ID
 */
export function generateWorkSessionId(): string {
  return crypto.randomUUID();
}

// --- Work Session Output Stream ---

/**
 * Appends output line to work session output list
 */
export async function appendWorkSessionOutput(sessionId: string, output: JobOutput): Promise<void> {
  const key = REDIS_KEYS.workSessionOutput(sessionId);
  const serialized = JSON.stringify(output);

  const pipeline = redis.pipeline();
  pipeline.rpush(key, serialized);
  pipeline.expire(key, TTL.workSessionOutput);
  await pipeline.exec();
}

/**
 * Gets work session output lines
 */
export async function getWorkSessionOutput(
  sessionId: string,
  options: { start?: number; end?: number } = {}
): Promise<JobOutput[]> {
  const { start = 0, end = -1 } = options;
  const key = REDIS_KEYS.workSessionOutput(sessionId);

  const lines = await redis.lrange(key, start, end);

  return lines.map((line) => JSON.parse(line) as JobOutput);
}

/**
 * Gets output line count for a work session
 */
export async function getWorkSessionOutputCount(sessionId: string): Promise<number> {
  const key = REDIS_KEYS.workSessionOutput(sessionId);
  return redis.llen(key);
}

// --- Work Session Streams ---

export interface WorkSessionInitMessage {
  sessionId: string;
  userId: string;
  providerId: string;
  repoUrl: string;
  repoName: string;
  baseBranch: string;
}

export interface WorkSessionJobMessage {
  sessionId: string;
  jobId: string;
  userId: string;
  prompt: string;
  environment: string;
}

export interface WorkSessionPushMessage {
  sessionId: string;
  userId: string;
  title?: string;
  description?: string;
}

/**
 * Enqueues a work session init task (clone repo, create branch)
 */
export async function enqueueWorkSessionInit(message: WorkSessionInitMessage): Promise<string> {
  const streamKey = REDIS_KEYS.workSessionsInitStream;

  const messageId = await redis.xadd(
    streamKey,
    "*",
    "session_id", message.sessionId,
    "user_id", message.userId,
    "provider_id", message.providerId,
    "repo_url", message.repoUrl,
    "repo_name", message.repoName,
    "base_branch", message.baseBranch
  );

  return messageId as string;
}

/**
 * Enqueues a work session job task (run prompt)
 */
export async function enqueueWorkSessionJob(message: WorkSessionJobMessage): Promise<string> {
  const streamKey = REDIS_KEYS.workSessionsJobsStream;

  const messageId = await redis.xadd(
    streamKey,
    "*",
    "session_id", message.sessionId,
    "job_id", message.jobId,
    "user_id", message.userId,
    "prompt", message.prompt,
    "environment", message.environment
  );

  return messageId as string;
}

/**
 * Enqueues a work session push task (push branch, create MR)
 */
export async function enqueueWorkSessionPush(message: WorkSessionPushMessage): Promise<string> {
  const streamKey = REDIS_KEYS.workSessionsPushStream;

  const args: string[] = [
    "session_id", message.sessionId,
    "user_id", message.userId,
  ];

  if (message.title) {
    args.push("title", message.title);
  }
  if (message.description) {
    args.push("description", message.description);
  }

  const messageId = await redis.xadd(streamKey, "*", ...args);

  return messageId as string;
}

/**
 * Creates consumer groups for work session streams if they don't exist
 */
export async function ensureWorkSessionConsumerGroups(): Promise<void> {
  const streams = [
    { key: REDIS_KEYS.workSessionsInitStream, group: REDIS_KEYS.workSessionsInitConsumerGroup },
    { key: REDIS_KEYS.workSessionsJobsStream, group: REDIS_KEYS.workSessionsJobsConsumerGroup },
    { key: REDIS_KEYS.workSessionsPushStream, group: REDIS_KEYS.workSessionsPushConsumerGroup },
  ];

  for (const { key, group } of streams) {
    try {
      await redis.xgroup("CREATE", key, group, "0", "MKSTREAM");
      console.log(`[work-session] Consumer group created: ${group}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("BUSYGROUP")) {
        continue;
      }
      throw error;
    }
  }
}
