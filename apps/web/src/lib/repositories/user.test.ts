import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import type { User } from "@repobox/types";

vi.mock("../redis", () => ({
  redis: {
    hset: vi.fn(),
    hgetall: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
  },
}));

import {
  createUser,
  getUser,
  updateUser,
  updateUserLastLogin,
  deleteUser,
  userExists,
} from "./user";
import { redis } from "../redis";

// Type-safe mock helpers
const hset = redis.hset as Mock;
const hgetall = redis.hgetall as Mock;
const exists = redis.exists as Mock;
const del = redis.del as Mock;

describe("UserRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    avatarUrl: "https://example.com/avatar.png",
    authProvider: "github",
    createdAt: 1700000000000,
    lastLoginAt: 1700000000000,
  };

  describe("createUser", () => {
    it("stores user with snake_case keys", async () => {
      hset.mockResolvedValue("OK");

      await createUser(mockUser);

      expect(hset).toHaveBeenCalledWith("user:user-123", {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatar_url: "https://example.com/avatar.png",
        auth_provider: "github",
        created_at: "1700000000000",
        last_login_at: "1700000000000",
      });
    });

    it("returns the user", async () => {
      hset.mockResolvedValue("OK");

      const result = await createUser(mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe("getUser", () => {
    it("returns user when found", async () => {
      hgetall.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatar_url: "https://example.com/avatar.png",
        auth_provider: "github",
        created_at: "1700000000000",
        last_login_at: "1700000000000",
      });

      const result = await getUser("user-123");

      expect(result).toEqual(mockUser);
      expect(hgetall).toHaveBeenCalledWith("user:user-123");
    });

    it("returns null when user not found", async () => {
      hgetall.mockResolvedValue({});

      const result = await getUser("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null for null response", async () => {
      hgetall.mockResolvedValue(null as unknown as Record<string, string>);

      const result = await getUser("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("updateUserLastLogin", () => {
    it("updates last_login_at timestamp", async () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      hset.mockResolvedValue("OK");

      await updateUserLastLogin("user-123");

      expect(hset).toHaveBeenCalledWith("user:user-123", "last_login_at", String(now));
    });
  });

  describe("updateUser", () => {
    it("updates specific fields", async () => {
      hset.mockResolvedValue("OK");

      await updateUser("user-123", {
        name: "New Name",
        avatarUrl: "https://new-avatar.png",
      });

      expect(hset).toHaveBeenCalledWith("user:user-123", {
        name: "New Name",
        avatar_url: "https://new-avatar.png",
      });
    });
  });

  describe("deleteUser", () => {
    it("returns true when user deleted", async () => {
      del.mockResolvedValue(1);

      const result = await deleteUser("user-123");

      expect(result).toBe(true);
      expect(del).toHaveBeenCalledWith("user:user-123");
    });

    it("returns false when user not found", async () => {
      del.mockResolvedValue(0);

      const result = await deleteUser("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("userExists", () => {
    it("returns true when user exists", async () => {
      exists.mockResolvedValue(1);

      const result = await userExists("user-123");

      expect(result).toBe(true);
      expect(exists).toHaveBeenCalledWith("user:user-123");
    });

    it("returns false when user does not exist", async () => {
      exists.mockResolvedValue(0);

      const result = await userExists("nonexistent");

      expect(result).toBe(false);
    });
  });
});
