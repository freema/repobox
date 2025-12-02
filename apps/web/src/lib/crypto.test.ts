import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encrypt, decrypt, maskToken } from "./crypto";

describe("crypto", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encrypt/decrypt", () => {
    it("encrypts and decrypts with hex key", () => {
      // 32-byte key as hex (64 chars)
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const plaintext = "my-secret-token";
      const encrypted = encrypt(plaintext);

      // Should be in format iv:authTag:ciphertext
      expect(encrypted.split(":")).toHaveLength(3);
      expect(encrypted).not.toBe(plaintext);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts with base64 key", () => {
      // 32-byte key as base64 (44 chars)
      process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

      const plaintext = "another-secret-token";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts with raw 32-char key", () => {
      // 32-byte key as raw string
      process.env.ENCRYPTION_KEY = "12345678901234567890123456789012";

      const plaintext = "glpat-xxxxxxxxxxxxxxxxxxxx";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertexts for same plaintext (due to random IV)", () => {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const plaintext = "same-token";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it("handles empty string", () => {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const plaintext = "";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode characters", () => {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const plaintext = "token-with-émojis-🔐";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("throws on missing ENCRYPTION_KEY", () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY environment variable is not set");
    });

    it("throws on invalid key length", () => {
      process.env.ENCRYPTION_KEY = "too-short";

      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be 32 bytes");
    });

    it("throws on invalid encrypted data format", () => {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      expect(() => decrypt("not-valid-format")).toThrow("Invalid encrypted data format");
    });

    it("throws on tampered auth tag", () => {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const encrypted = encrypt("secret");
      const parts = encrypted.split(":");
      // Tamper with auth tag
      parts[1] = "AAAAAAAAAAAAAAAAAAAAAA==";
      const tampered = parts.join(":");

      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws on tampered ciphertext", () => {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const encrypted = encrypt("secret");
      const parts = encrypted.split(":");
      // Tamper with ciphertext
      parts[2] = "AAAAAAAAAA==";
      const tampered = parts.join(":");

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("maskToken", () => {
    it("masks token showing first 4 and last 4 characters", () => {
      expect(maskToken("glpat-xxxxxxxxxxxxxxxxxxxx")).toBe("glpa****xxxx");
    });

    it("masks short tokens completely", () => {
      expect(maskToken("short")).toBe("****");
      expect(maskToken("123456789012")).toBe("****");
    });

    it("handles exactly 13 character token", () => {
      expect(maskToken("1234567890123")).toBe("1234****0123");
    });
  });
});
