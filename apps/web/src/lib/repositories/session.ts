import { redis } from "../redis";
import { REDIS_KEYS, TTL } from "./keys";
import { toHash, fromHash, type FieldSchema } from "./serialization";
import type { AuthSession } from "@repobox/types";

const SESSION_SCHEMA: FieldSchema = {
  userId: "string",
  createdAt: "number",
  expiresAt: "number",
};

/**
 * Creates a new auth session with TTL
 */
export async function createSession(sessionId: string, session: AuthSession): Promise<AuthSession> {
  const key = REDIS_KEYS.session(sessionId);

  // Use pipeline for atomic operation
  const pipeline = redis.pipeline();
  pipeline.hset(key, toHash(session));
  pipeline.expire(key, TTL.session);
  await pipeline.exec();

  return session;
}

/**
 * Gets an auth session by ID
 */
export async function getSession(sessionId: string): Promise<AuthSession | null> {
  const key = REDIS_KEYS.session(sessionId);
  const data = await redis.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  const session = fromHash<AuthSession>(data, SESSION_SCHEMA);

  // Check if session has expired
  if (session.expiresAt < Date.now()) {
    await deleteSession(sessionId);
    return null;
  }

  return session;
}

/**
 * Extends a session's expiration
 */
export async function extendSession(sessionId: string): Promise<boolean> {
  const key = REDIS_KEYS.session(sessionId);
  const exists = await redis.exists(key);

  if (!exists) {
    return false;
  }

  const newExpiresAt = Date.now() + TTL.session * 1000;

  const pipeline = redis.pipeline();
  pipeline.hset(key, "expires_at", String(newExpiresAt));
  pipeline.expire(key, TTL.session);
  await pipeline.exec();

  return true;
}

/**
 * Deletes a session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const key = REDIS_KEYS.session(sessionId);
  const deleted = await redis.del(key);
  return deleted > 0;
}

/**
 * Checks if a session exists and is valid
 */
export async function sessionExists(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  return session !== null;
}

/**
 * Creates a session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Creates a new auth session for a user
 */
export async function createUserSession(userId: string): Promise<{
  sessionId: string;
  session: AuthSession;
}> {
  const sessionId = generateSessionId();
  const now = Date.now();
  const session: AuthSession = {
    userId,
    createdAt: now,
    expiresAt: now + TTL.session * 1000,
  };

  await createSession(sessionId, session);

  return { sessionId, session };
}
