import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import type { Session } from "@repobox/types";

const mockPipeline = {
  hset: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

vi.mock("../redis", () => ({
  redis: {
    hgetall: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
    pipeline: vi.fn(() => mockPipeline),
  },
}));

import {
  createSession,
  getSession,
  extendSession,
  deleteSession,
  sessionExists,
  generateSessionId,
  createUserSession,
} from "./session";
import { TTL } from "./keys";
import { redis } from "../redis";

// Type-safe mock helpers
const hgetall = redis.hgetall as Mock;
const exists = redis.exists as Mock;
const del = redis.del as Mock;
const pipeline = redis.pipeline as Mock;

describe("SessionRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession: Session = {
    userId: "user-123",
    createdAt: 1700000000000,
    expiresAt: 1700000000000 + TTL.session * 1000,
  };

  describe("createSession", () => {
    it("stores session with TTL", async () => {
      const sessionId = "session-abc";

      await createSession(sessionId, mockSession);

      expect(pipeline).toHaveBeenCalled();
      expect(mockPipeline.hset).toHaveBeenCalledWith(
        "session:session-abc",
        expect.objectContaining({
          user_id: "user-123",
        })
      );
      expect(mockPipeline.expire).toHaveBeenCalledWith("session:session-abc", TTL.session);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it("returns the session", async () => {
      const result = await createSession("session-abc", mockSession);

      expect(result).toEqual(mockSession);
    });
  });

  describe("getSession", () => {
    it("returns session when found and not expired", async () => {
      const futureExpiry = Date.now() + 1000000;
      hgetall.mockResolvedValue({
        user_id: "user-123",
        created_at: "1700000000000",
        expires_at: String(futureExpiry),
      });

      const result = await getSession("session-abc");

      expect(result).toEqual({
        userId: "user-123",
        createdAt: 1700000000000,
        expiresAt: futureExpiry,
      });
    });

    it("returns null and deletes when session expired", async () => {
      const pastExpiry = Date.now() - 1000;
      hgetall.mockResolvedValue({
        user_id: "user-123",
        created_at: "1700000000000",
        expires_at: String(pastExpiry),
      });
      del.mockResolvedValue(1);

      const result = await getSession("session-abc");

      expect(result).toBeNull();
      expect(del).toHaveBeenCalledWith("session:session-abc");
    });

    it("returns null when session not found", async () => {
      hgetall.mockResolvedValue({});

      const result = await getSession("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("extendSession", () => {
    it("extends session TTL when exists", async () => {
      exists.mockResolvedValue(1);

      const result = await extendSession("session-abc");

      expect(result).toBe(true);
      expect(mockPipeline.hset).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalledWith("session:session-abc", TTL.session);
    });

    it("returns false when session not found", async () => {
      exists.mockResolvedValue(0);

      const result = await extendSession("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("deleteSession", () => {
    it("returns true when session deleted", async () => {
      del.mockResolvedValue(1);

      const result = await deleteSession("session-abc");

      expect(result).toBe(true);
    });

    it("returns false when session not found", async () => {
      del.mockResolvedValue(0);

      const result = await deleteSession("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("sessionExists", () => {
    it("returns true for valid non-expired session", async () => {
      const futureExpiry = Date.now() + 1000000;
      hgetall.mockResolvedValue({
        user_id: "user-123",
        created_at: "1700000000000",
        expires_at: String(futureExpiry),
      });

      const result = await sessionExists("session-abc");

      expect(result).toBe(true);
    });

    it("returns false for expired session", async () => {
      const pastExpiry = Date.now() - 1000;
      hgetall.mockResolvedValue({
        user_id: "user-123",
        created_at: "1700000000000",
        expires_at: String(pastExpiry),
      });
      del.mockResolvedValue(1);

      const result = await sessionExists("session-abc");

      expect(result).toBe(false);
    });
  });

  describe("generateSessionId", () => {
    it("generates unique UUIDs", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("createUserSession", () => {
    it("creates session with correct expiry", async () => {
      const now = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      const result = await createUserSession("user-123");

      expect(result.session.userId).toBe("user-123");
      expect(result.session.createdAt).toBe(now);
      expect(result.session.expiresAt).toBe(now + TTL.session * 1000);
      expect(result.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });
});
