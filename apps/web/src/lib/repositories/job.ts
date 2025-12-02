import { redis } from "../redis";
import { REDIS_KEYS, TTL } from "./keys";
import { toHash, fromHash, type FieldSchema } from "./serialization";
import type { Job, JobStatus, JobOutput } from "@repobox/types";

const JOB_SCHEMA: FieldSchema = {
  id: "string",
  userId: "string",
  providerId: "string",
  repoUrl: "string",
  repoName: "string",
  branch: "string",
  prompt: "string",
  environment: "string",
  status: "string",
  mrUrl: "optional_string",
  linesAdded: "number",
  linesRemoved: "number",
  errorMessage: "optional_string",
  createdAt: "number",
  startedAt: "optional_number",
  finishedAt: "optional_number",
};

/**
 * Creates a new job and adds it to user's job index
 */
export async function createJob(job: Job): Promise<Job> {
  const jobKey = REDIS_KEYS.job(job.id);
  const userJobsKey = REDIS_KEYS.userJobs(job.userId);

  const pipeline = redis.pipeline();

  // Store job hash
  pipeline.hset(jobKey, toHash(job));

  // Add to user's jobs sorted set (score = createdAt for time-based sorting)
  pipeline.zadd(userJobsKey, job.createdAt, job.id);

  await pipeline.exec();

  return job;
}

/**
 * Gets a job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const key = REDIS_KEYS.job(jobId);
  const data = await redis.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return fromHash<Job>(data, JOB_SCHEMA);
}

/**
 * Updates job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  additionalFields?: {
    startedAt?: number;
    finishedAt?: number;
    mrUrl?: string;
    linesAdded?: number;
    linesRemoved?: number;
    errorMessage?: string;
  }
): Promise<void> {
  const key = REDIS_KEYS.job(jobId);

  const updates: Record<string, string> = {
    status,
  };

  if (additionalFields) {
    if (additionalFields.startedAt !== undefined) {
      updates.started_at = String(additionalFields.startedAt);
    }
    if (additionalFields.finishedAt !== undefined) {
      updates.finished_at = String(additionalFields.finishedAt);
    }
    if (additionalFields.mrUrl !== undefined) {
      updates.mr_url = additionalFields.mrUrl;
    }
    if (additionalFields.linesAdded !== undefined) {
      updates.lines_added = String(additionalFields.linesAdded);
    }
    if (additionalFields.linesRemoved !== undefined) {
      updates.lines_removed = String(additionalFields.linesRemoved);
    }
    if (additionalFields.errorMessage !== undefined) {
      updates.error_message = additionalFields.errorMessage;
    }
  }

  await redis.hset(key, updates);
}

/**
 * Gets jobs for a user with pagination
 * Jobs are sorted by creation time (newest first)
 */
export async function getUserJobs(
  userId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<Job[]> {
  const { offset = 0, limit = 50 } = options;
  const userJobsKey = REDIS_KEYS.userJobs(userId);

  // Get job IDs from sorted set (reverse order for newest first)
  const jobIds = await redis.zrevrange(userJobsKey, offset, offset + limit - 1);

  if (jobIds.length === 0) {
    return [];
  }

  // Batch fetch jobs using pipeline
  const pipeline = redis.pipeline();
  for (const jobId of jobIds) {
    pipeline.hgetall(REDIS_KEYS.job(jobId));
  }

  const results = await pipeline.exec();
  const jobs: Job[] = [];

  for (const result of results || []) {
    if (result && result[1] && typeof result[1] === "object") {
      const data = result[1] as Record<string, string>;
      if (Object.keys(data).length > 0) {
        jobs.push(fromHash<Job>(data, JOB_SCHEMA));
      }
    }
  }

  return jobs;
}

/**
 * Gets total job count for a user
 */
export async function getUserJobCount(userId: string): Promise<number> {
  const userJobsKey = REDIS_KEYS.userJobs(userId);
  return redis.zcard(userJobsKey);
}

/**
 * Deletes a job and removes from user's index
 */
export async function deleteJob(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job) {
    return false;
  }

  const jobKey = REDIS_KEYS.job(jobId);
  const userJobsKey = REDIS_KEYS.userJobs(job.userId);
  const outputKey = REDIS_KEYS.jobOutput(jobId);

  const pipeline = redis.pipeline();
  pipeline.del(jobKey);
  pipeline.zrem(userJobsKey, jobId);
  pipeline.del(outputKey);
  await pipeline.exec();

  return true;
}

/**
 * Generates a unique job ID
 */
export function generateJobId(): string {
  return crypto.randomUUID();
}

// --- Job Output Stream ---

/**
 * Appends output line to job output list
 */
export async function appendJobOutput(jobId: string, output: JobOutput): Promise<void> {
  const key = REDIS_KEYS.jobOutput(jobId);
  const serialized = JSON.stringify(output);

  const pipeline = redis.pipeline();
  pipeline.rpush(key, serialized);
  pipeline.expire(key, TTL.jobOutput);
  await pipeline.exec();
}

/**
 * Gets job output lines
 */
export async function getJobOutput(
  jobId: string,
  options: { start?: number; end?: number } = {}
): Promise<JobOutput[]> {
  const { start = 0, end = -1 } = options;
  const key = REDIS_KEYS.jobOutput(jobId);

  const lines = await redis.lrange(key, start, end);

  return lines.map((line) => JSON.parse(line) as JobOutput);
}

/**
 * Gets output line count for a job
 */
export async function getJobOutputCount(jobId: string): Promise<number> {
  const key = REDIS_KEYS.jobOutput(jobId);
  return redis.llen(key);
}

// --- Job Queue Stream ---

export interface JobStreamMessage {
  jobId: string;
  userId: string;
  providerId: string;
  repoUrl: string;
  prompt: string;
  environment: string;
}

/**
 * Adds a job to the job stream queue
 * Returns the stream message ID
 */
export async function enqueueJob(message: JobStreamMessage): Promise<string> {
  const streamKey = REDIS_KEYS.jobsStream;

  // XADD with * auto-generates message ID
  const messageId = await redis.xadd(
    streamKey,
    "*",
    "job_id",
    message.jobId,
    "user_id",
    message.userId,
    "provider_id",
    message.providerId,
    "repo_url",
    message.repoUrl,
    "prompt",
    message.prompt,
    "environment",
    message.environment
  );

  return messageId as string;
}

/**
 * Creates consumer group if it doesn't exist
 * This should be called at application startup
 */
export async function ensureConsumerGroup(): Promise<void> {
  const streamKey = REDIS_KEYS.jobsStream;
  const groupName = REDIS_KEYS.jobsConsumerGroup;

  try {
    // Create stream with first entry if it doesn't exist
    await redis.xgroup("CREATE", streamKey, groupName, "0", "MKSTREAM");
    console.log("[job-stream] Consumer group created");
  } catch (error) {
    // Group already exists - this is expected
    if (error instanceof Error && error.message.includes("BUSYGROUP")) {
      return;
    }
    throw error;
  }
}

/**
 * Gets pending jobs from the stream (for monitoring)
 */
export async function getPendingJobs(): Promise<Array<{ id: string; message: JobStreamMessage }>> {
  const streamKey = REDIS_KEYS.jobsStream;

  // Read all messages from beginning (for monitoring only)
  const messages = await redis.xrange(streamKey, "-", "+", "COUNT", 100);

  return messages.map(([id, fields]) => ({
    id,
    message: parseStreamFields(fields),
  }));
}

/**
 * Parses stream field array to JobStreamMessage
 */
function parseStreamFields(fields: string[]): JobStreamMessage {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }

  return {
    jobId: obj.job_id,
    userId: obj.user_id,
    providerId: obj.provider_id,
    repoUrl: obj.repo_url,
    prompt: obj.prompt,
    environment: obj.environment,
  };
}
