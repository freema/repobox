import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import type { Job, JobOutput } from "@repobox/types";

const mockPipeline = {
  hset: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  del: vi.fn().mockReturnThis(),
  zrem: vi.fn().mockReturnThis(),
  hgetall: vi.fn().mockReturnThis(),
  rpush: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

vi.mock("../redis", () => ({
  redis: {
    hset: vi.fn(),
    hgetall: vi.fn(),
    del: vi.fn(),
    zrevrange: vi.fn(),
    zcard: vi.fn(),
    lrange: vi.fn(),
    llen: vi.fn(),
    xadd: vi.fn(),
    xgroup: vi.fn(),
    xrange: vi.fn(),
    pipeline: vi.fn(() => mockPipeline),
  },
}));

import {
  createJob,
  getJob,
  updateJobStatus,
  getUserJobs,
  getUserJobCount,
  deleteJob,
  generateJobId,
  appendJobOutput,
  getJobOutput,
  getJobOutputCount,
  enqueueJob,
  ensureConsumerGroup,
  getPendingJobs,
} from "./job";
import { redis } from "../redis";

// Type-safe mock helpers
const hset = redis.hset as Mock;
const hgetall = redis.hgetall as Mock;
const zrevrange = redis.zrevrange as Mock;
const zcard = redis.zcard as Mock;
const lrange = redis.lrange as Mock;
const llen = redis.llen as Mock;
const xadd = redis.xadd as Mock;
const xgroup = redis.xgroup as Mock;
const xrange = redis.xrange as Mock;
const pipeline = redis.pipeline as Mock;

describe("JobRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.exec.mockResolvedValue([]);
  });

  const mockJob: Job = {
    id: "job-123",
    userId: "user-456",
    providerId: "provider-789",
    repoUrl: "https://github.com/test/repo",
    repoName: "test/repo",
    branch: "feature/test",
    prompt: "Fix the bug",
    environment: "default",
    status: "pending",
    linesAdded: 0,
    linesRemoved: 0,
    createdAt: 1700000000000,
  };

  describe("createJob", () => {
    it("stores job and adds to user index", async () => {
      await createJob(mockJob);

      expect(pipeline).toHaveBeenCalled();
      expect(mockPipeline.hset).toHaveBeenCalledWith(
        "job:job-123",
        expect.objectContaining({
          id: "job-123",
          user_id: "user-456",
          status: "pending",
        })
      );
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        "jobs:user:user-456",
        1700000000000,
        "job-123"
      );
    });

    it("returns the job", async () => {
      const result = await createJob(mockJob);

      expect(result).toEqual(mockJob);
    });
  });

  describe("getJob", () => {
    it("returns job when found", async () => {
      hgetall.mockResolvedValue({
        id: "job-123",
        user_id: "user-456",
        provider_id: "provider-789",
        repo_url: "https://github.com/test/repo",
        repo_name: "test/repo",
        branch: "feature/test",
        prompt: "Fix the bug",
        environment: "default",
        status: "pending",
        lines_added: "0",
        lines_removed: "0",
        created_at: "1700000000000",
      });

      const result = await getJob("job-123");

      expect(result).toEqual(mockJob);
    });

    it("returns null when job not found", async () => {
      hgetall.mockResolvedValue({});

      const result = await getJob("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("updateJobStatus", () => {
    it("updates status only", async () => {
      hset.mockResolvedValue("OK");

      await updateJobStatus("job-123", "running");

      expect(hset).toHaveBeenCalledWith("job:job-123", {
        status: "running",
      });
    });

    it("updates status with additional fields", async () => {
      hset.mockResolvedValue("OK");

      await updateJobStatus("job-123", "success", {
        finishedAt: 1700001000000,
        mrUrl: "https://github.com/test/repo/pull/1",
        linesAdded: 50,
        linesRemoved: 10,
      });

      expect(hset).toHaveBeenCalledWith("job:job-123", {
        status: "success",
        finished_at: "1700001000000",
        mr_url: "https://github.com/test/repo/pull/1",
        lines_added: "50",
        lines_removed: "10",
      });
    });

    it("updates status with error message", async () => {
      hset.mockResolvedValue("OK");

      await updateJobStatus("job-123", "failed", {
        finishedAt: 1700001000000,
        errorMessage: "Clone failed",
      });

      expect(hset).toHaveBeenCalledWith("job:job-123", {
        status: "failed",
        finished_at: "1700001000000",
        error_message: "Clone failed",
      });
    });
  });

  describe("getUserJobs", () => {
    it("returns jobs sorted by creation time (newest first)", async () => {
      zrevrange.mockResolvedValue(["job-2", "job-1"]);
      mockPipeline.exec.mockResolvedValue([
        [
          null,
          {
            id: "job-2",
            user_id: "user-456",
            provider_id: "p",
            repo_url: "url",
            repo_name: "repo",
            branch: "main",
            prompt: "test",
            environment: "default",
            status: "success",
            lines_added: "10",
            lines_removed: "5",
            created_at: "1700002000000",
          },
        ],
        [
          null,
          {
            id: "job-1",
            user_id: "user-456",
            provider_id: "p",
            repo_url: "url",
            repo_name: "repo",
            branch: "main",
            prompt: "test",
            environment: "default",
            status: "pending",
            lines_added: "0",
            lines_removed: "0",
            created_at: "1700001000000",
          },
        ],
      ]);

      const result = await getUserJobs("user-456");

      expect(zrevrange).toHaveBeenCalledWith("jobs:user:user-456", 0, 49);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("job-2");
      expect(result[1].id).toBe("job-1");
    });

    it("returns empty array when no jobs", async () => {
      zrevrange.mockResolvedValue([]);

      const result = await getUserJobs("user-456");

      expect(result).toEqual([]);
    });

    it("supports pagination", async () => {
      zrevrange.mockResolvedValue([]);

      await getUserJobs("user-456", { offset: 10, limit: 20 });

      expect(zrevrange).toHaveBeenCalledWith("jobs:user:user-456", 10, 29);
    });
  });

  describe("getUserJobCount", () => {
    it("returns job count", async () => {
      zcard.mockResolvedValue(42);

      const result = await getUserJobCount("user-456");

      expect(result).toBe(42);
      expect(zcard).toHaveBeenCalledWith("jobs:user:user-456");
    });
  });

  describe("deleteJob", () => {
    it("deletes job and removes from index", async () => {
      hgetall.mockResolvedValue({
        id: "job-123",
        user_id: "user-456",
        provider_id: "p",
        repo_url: "url",
        repo_name: "repo",
        branch: "main",
        prompt: "test",
        environment: "default",
        status: "success",
        lines_added: "0",
        lines_removed: "0",
        created_at: "1700000000000",
      });

      const result = await deleteJob("job-123");

      expect(result).toBe(true);
      expect(mockPipeline.del).toHaveBeenCalledWith("job:job-123");
      expect(mockPipeline.zrem).toHaveBeenCalledWith("jobs:user:user-456", "job-123");
      expect(mockPipeline.del).toHaveBeenCalledWith("job:job-123:output");
    });

    it("returns false when job not found", async () => {
      hgetall.mockResolvedValue({});

      const result = await deleteJob("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("generateJobId", () => {
    it("generates unique UUIDs", () => {
      const id1 = generateJobId();
      const id2 = generateJobId();

      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("Job Output", () => {
    const mockOutput: JobOutput = {
      timestamp: 1700000000000,
      line: "Building project...",
      stream: "stdout",
    };

    describe("appendJobOutput", () => {
      it("appends output with TTL", async () => {
        await appendJobOutput("job-123", mockOutput);

        expect(mockPipeline.rpush).toHaveBeenCalledWith(
          "job:job-123:output",
          JSON.stringify(mockOutput)
        );
        expect(mockPipeline.expire).toHaveBeenCalled();
      });
    });

    describe("getJobOutput", () => {
      it("returns parsed output lines", async () => {
        lrange.mockResolvedValue([
          JSON.stringify(mockOutput),
          JSON.stringify({ ...mockOutput, line: "Done!" }),
        ]);

        const result = await getJobOutput("job-123");

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockOutput);
        expect(result[1].line).toBe("Done!");
      });

      it("supports range parameters", async () => {
        lrange.mockResolvedValue([]);

        await getJobOutput("job-123", { start: 10, end: 20 });

        expect(lrange).toHaveBeenCalledWith("job:job-123:output", 10, 20);
      });
    });

    describe("getJobOutputCount", () => {
      it("returns output line count", async () => {
        llen.mockResolvedValue(150);

        const result = await getJobOutputCount("job-123");

        expect(result).toBe(150);
      });
    });
  });

  describe("Job Queue Stream", () => {
    describe("enqueueJob", () => {
      it("adds job to stream", async () => {
        xadd.mockResolvedValue("1700000000000-0");

        const result = await enqueueJob({
          jobId: "job-123",
          userId: "user-456",
          providerId: "provider-789",
          repoUrl: "https://github.com/test/repo",
          prompt: "Fix the bug",
          environment: "default",
        });

        expect(result).toBe("1700000000000-0");
        expect(xadd).toHaveBeenCalledWith(
          "jobs:stream",
          "*",
          "job_id",
          "job-123",
          "user_id",
          "user-456",
          "provider_id",
          "provider-789",
          "repo_url",
          "https://github.com/test/repo",
          "prompt",
          "Fix the bug",
          "environment",
          "default"
        );
      });
    });

    describe("ensureConsumerGroup", () => {
      it("creates consumer group", async () => {
        xgroup.mockResolvedValue("OK");

        await ensureConsumerGroup();

        expect(xgroup).toHaveBeenCalledWith(
          "CREATE",
          "jobs:stream",
          "jobs:stream:runners",
          "0",
          "MKSTREAM"
        );
      });

      it("ignores BUSYGROUP error", async () => {
        xgroup.mockRejectedValue(new Error("BUSYGROUP Consumer Group name already exists"));

        await expect(ensureConsumerGroup()).resolves.not.toThrow();
      });

      it("rethrows other errors", async () => {
        xgroup.mockRejectedValue(new Error("Connection refused"));

        await expect(ensureConsumerGroup()).rejects.toThrow("Connection refused");
      });
    });

    describe("getPendingJobs", () => {
      it("returns pending jobs from stream", async () => {
        xrange.mockResolvedValue([
          [
            "1700000000000-0",
            [
              "job_id",
              "job-123",
              "user_id",
              "user-456",
              "provider_id",
              "provider-789",
              "repo_url",
              "https://github.com/test/repo",
              "prompt",
              "Fix the bug",
              "environment",
              "default",
            ],
          ],
        ]);

        const result = await getPendingJobs();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("1700000000000-0");
        expect(result[0].message.jobId).toBe("job-123");
        expect(result[0].message.userId).toBe("user-456");
      });
    });
  });
});
