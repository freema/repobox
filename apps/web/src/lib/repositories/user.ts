import { redis } from "../redis";
import { REDIS_KEYS } from "./keys";
import { toHash, fromHash, type FieldSchema } from "./serialization";
import type { User } from "@repobox/types";

const USER_SCHEMA: FieldSchema = {
  id: "string",
  email: "string",
  name: "string",
  avatarUrl: "string",
  authProvider: "string",
  createdAt: "number",
  lastLoginAt: "number",
};

/**
 * Creates or updates a user
 */
export async function createUser(user: User): Promise<User> {
  const key = REDIS_KEYS.user(user.id);
  await redis.hset(key, toHash(user));
  return user;
}

/**
 * Gets a user by ID
 */
export async function getUser(userId: string): Promise<User | null> {
  const key = REDIS_KEYS.user(userId);
  const data = await redis.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return fromHash<User>(data, USER_SCHEMA);
}

/**
 * Updates a user's last login timestamp
 */
export async function updateUserLastLogin(userId: string): Promise<void> {
  const key = REDIS_KEYS.user(userId);
  await redis.hset(key, "last_login_at", String(Date.now()));
}

/**
 * Updates specific user fields
 */
export async function updateUser(
  userId: string,
  updates: Partial<Omit<User, "id">>
): Promise<void> {
  const key = REDIS_KEYS.user(userId);
  const hashUpdates = toHash(updates as Record<string, string | number | boolean | null>);
  await redis.hset(key, hashUpdates);
}

/**
 * Deletes a user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const key = REDIS_KEYS.user(userId);
  const deleted = await redis.del(key);
  return deleted > 0;
}

/**
 * Checks if a user exists
 */
export async function userExists(userId: string): Promise<boolean> {
  const key = REDIS_KEYS.user(userId);
  return (await redis.exists(key)) > 0;
}
