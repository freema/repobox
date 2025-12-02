import { describe, it, expect } from "vitest";
import { toHash, fromHash, camelToSnake, snakeToCamel, type FieldSchema } from "./serialization";

describe("serialization", () => {
  describe("camelToSnake", () => {
    it("converts camelCase to snake_case", () => {
      expect(camelToSnake("userId")).toBe("user_id");
      expect(camelToSnake("createdAt")).toBe("created_at");
      expect(camelToSnake("mrUrl")).toBe("mr_url");
    });

    it("handles already lowercase strings", () => {
      expect(camelToSnake("id")).toBe("id");
      expect(camelToSnake("name")).toBe("name");
    });

    it("handles multiple uppercase letters", () => {
      expect(camelToSnake("lastLoginAt")).toBe("last_login_at");
      expect(camelToSnake("reposCount")).toBe("repos_count");
    });
  });

  describe("snakeToCamel", () => {
    it("converts snake_case to camelCase", () => {
      expect(snakeToCamel("user_id")).toBe("userId");
      expect(snakeToCamel("created_at")).toBe("createdAt");
      expect(snakeToCamel("mr_url")).toBe("mrUrl");
    });

    it("handles already camelCase strings", () => {
      expect(snakeToCamel("id")).toBe("id");
      expect(snakeToCamel("name")).toBe("name");
    });
  });

  describe("toHash", () => {
    it("converts object to Redis hash with snake_case keys", () => {
      const obj = {
        userId: "123",
        createdAt: 1700000000000,
        verified: true,
      };

      const hash = toHash(obj);

      expect(hash).toEqual({
        user_id: "123",
        created_at: "1700000000000",
        verified: "true",
      });
    });

    it("converts null/undefined to empty string", () => {
      const obj = {
        mrUrl: null,
        errorMessage: undefined,
      };

      const hash = toHash(obj as Record<string, string | null | undefined>);

      expect(hash).toEqual({
        mr_url: "",
        error_message: "",
      });
    });

    it("converts boolean false correctly", () => {
      const obj = { verified: false };
      const hash = toHash(obj);

      expect(hash).toEqual({ verified: "false" });
    });

    it("handles zero values", () => {
      const obj = { linesAdded: 0, linesRemoved: 0 };
      const hash = toHash(obj);

      expect(hash).toEqual({
        lines_added: "0",
        lines_removed: "0",
      });
    });
  });

  describe("fromHash", () => {
    const schema: FieldSchema = {
      id: "string",
      userId: "string",
      count: "number",
      verified: "boolean",
      mrUrl: "optional_string",
      startedAt: "optional_number",
    };

    it("converts Redis hash to object with correct types", () => {
      const hash = {
        id: "job-123",
        user_id: "user-456",
        count: "42",
        verified: "true",
        mr_url: "https://github.com/pr/1",
        started_at: "1700000000000",
      };

      const obj = fromHash<{
        id: string;
        userId: string;
        count: number;
        verified: boolean;
        mrUrl?: string;
        startedAt?: number;
      }>(hash, schema);

      expect(obj).toEqual({
        id: "job-123",
        userId: "user-456",
        count: 42,
        verified: true,
        mrUrl: "https://github.com/pr/1",
        startedAt: 1700000000000,
      });
    });

    it("handles missing optional fields", () => {
      const hash = {
        id: "job-123",
        user_id: "user-456",
        count: "10",
        verified: "false",
      };

      const obj = fromHash<{
        id: string;
        userId: string;
        count: number;
        verified: boolean;
        mrUrl?: string;
        startedAt?: number;
      }>(hash, schema);

      expect(obj.mrUrl).toBeUndefined();
      expect(obj.startedAt).toBeUndefined();
    });

    it("handles empty string for optional fields", () => {
      const hash = {
        id: "job-123",
        user_id: "user-456",
        count: "10",
        verified: "false",
        mr_url: "",
        started_at: "",
      };

      const obj = fromHash<{
        id: string;
        userId: string;
        count: number;
        verified: boolean;
        mrUrl?: string;
        startedAt?: number;
      }>(hash, schema);

      expect(obj.mrUrl).toBeUndefined();
      expect(obj.startedAt).toBeUndefined();
    });

    it("handles boolean false", () => {
      const hash = { id: "1", user_id: "u", count: "0", verified: "false" };
      const obj = fromHash<{ verified: boolean }>(hash, schema);

      expect(obj.verified).toBe(false);
    });

    it("defaults number to 0 for missing values", () => {
      const hash = { id: "1", user_id: "u", verified: "true" };
      const obj = fromHash<{ count: number }>(hash, schema);

      expect(obj.count).toBe(0);
    });
  });
});
