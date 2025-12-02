import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

// AES-256-GCM constants
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Gets the encryption key from environment variable.
 * Key must be exactly 32 bytes (256 bits) for AES-256.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // If hex-encoded (64 chars = 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // If base64-encoded
  if (key.length === 44 && /^[A-Za-z0-9+/]+=*$/.test(key)) {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  }

  // If raw 32-byte string
  if (key.length === 32) {
    return Buffer.from(key, "utf8");
  }

  throw new Error(
    "ENCRYPTION_KEY must be 32 bytes: either 64 hex characters, 44 base64 characters, or 32 raw characters"
  );
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a string in format: iv:authTag:ciphertext (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts ciphertext that was encrypted with encrypt().
 * Expects format: iv:authTag:ciphertext (all base64 encoded)
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`
    );
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Masks a token for safe display/logging.
 * Shows only first 4 and last 4 characters.
 */
export function maskToken(token: string): string {
  if (token.length <= 12) {
    return "****";
  }
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}
