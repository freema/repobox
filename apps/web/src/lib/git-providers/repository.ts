import { redis } from "../redis";
import { encrypt, decrypt } from "../crypto";
import type { GitProviderConfig, GitProviderResponse } from "./types";

// Redis key helpers per SPEC.MD
const REDIS_KEYS = {
  provider: (userId: string, providerId: string) => `git_provider:${userId}:${providerId}`,
  userProviders: (userId: string) => `git_providers:${userId}`,
  repoCache: (userId: string, providerId: string) => `repos_cache:${userId}:${providerId}`,
} as const;

const REPO_CACHE_TTL = 300; // 5 minutes

/**
 * Generates a unique provider ID
 */
function generateProviderId(): string {
  return crypto.randomUUID();
}

/**
 * Converts Redis hash to GitProviderConfig
 */
function hashToConfig(data: Record<string, string>, id: string): GitProviderConfig {
  return {
    id,
    type: data.type as GitProviderConfig["type"],
    url: data.url,
    token: data.token, // Still encrypted
    username: data.username,
    verified: data.verified === "true",
    reposCount: parseInt(data.repos_count) || 0,
    createdAt: parseInt(data.created_at) || Date.now(),
    lastVerifiedAt: data.last_verified_at ? parseInt(data.last_verified_at) : null,
  };
}

/**
 * Converts GitProviderConfig to safe response (no token)
 */
export function configToResponse(config: GitProviderConfig): GitProviderResponse {
  return {
    id: config.id,
    type: config.type,
    url: config.url,
    username: config.username,
    verified: config.verified,
    reposCount: config.reposCount,
    createdAt: config.createdAt,
    lastVerifiedAt: config.lastVerifiedAt,
  };
}

/**
 * Creates a new git provider for a user
 */
export async function createGitProvider(
  userId: string,
  data: {
    type: GitProviderConfig["type"];
    url: string;
    token: string;
    username: string;
    verified: boolean;
    reposCount: number;
  }
): Promise<GitProviderConfig> {
  const providerId = generateProviderId();
  const providerKey = REDIS_KEYS.provider(userId, providerId);
  const userProvidersKey = REDIS_KEYS.userProviders(userId);
  const now = Date.now();

  const encryptedToken = encrypt(data.token);

  const config: GitProviderConfig = {
    id: providerId,
    type: data.type,
    url: data.url,
    token: encryptedToken,
    username: data.username,
    verified: data.verified,
    reposCount: data.reposCount,
    createdAt: now,
    lastVerifiedAt: data.verified ? now : null,
  };

  // Store provider hash
  await redis.hset(providerKey, {
    type: config.type,
    url: config.url,
    token: config.token,
    username: config.username,
    verified: String(config.verified),
    repos_count: String(config.reposCount),
    created_at: String(config.createdAt),
    last_verified_at: config.lastVerifiedAt ? String(config.lastVerifiedAt) : "",
  });

  // Add to user's provider set
  await redis.sadd(userProvidersKey, providerId);

  return config;
}

/**
 * Gets a git provider by ID for a user
 */
export async function getGitProvider(
  userId: string,
  providerId: string
): Promise<GitProviderConfig | null> {
  const providerKey = REDIS_KEYS.provider(userId, providerId);
  const data = await redis.hgetall(providerKey);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return hashToConfig(data, providerId);
}

/**
 * Gets all git providers for a user
 */
export async function getUserGitProviders(userId: string): Promise<GitProviderConfig[]> {
  const userProvidersKey = REDIS_KEYS.userProviders(userId);
  const providerIds = await redis.smembers(userProvidersKey);

  if (providerIds.length === 0) {
    return [];
  }

  const providers: GitProviderConfig[] = [];

  for (const providerId of providerIds) {
    const provider = await getGitProvider(userId, providerId);
    if (provider) {
      providers.push(provider);
    }
  }

  return providers;
}

/**
 * Updates a git provider's verification status
 */
export async function updateProviderVerification(
  userId: string,
  providerId: string,
  verified: boolean,
  reposCount: number
): Promise<void> {
  const providerKey = REDIS_KEYS.provider(userId, providerId);
  const now = Date.now();

  await redis.hset(providerKey, {
    verified: String(verified),
    repos_count: String(reposCount),
    last_verified_at: String(now),
  });
}

/**
 * Deletes a git provider and its cache
 */
export async function deleteGitProvider(userId: string, providerId: string): Promise<boolean> {
  const providerKey = REDIS_KEYS.provider(userId, providerId);
  const userProvidersKey = REDIS_KEYS.userProviders(userId);
  const cacheKey = REDIS_KEYS.repoCache(userId, providerId);

  // Check if provider exists
  const exists = await redis.exists(providerKey);
  if (!exists) {
    return false;
  }

  // Delete provider, remove from set, and clear cache
  await redis.del(providerKey);
  await redis.srem(userProvidersKey, providerId);
  await redis.del(cacheKey);

  return true;
}

/**
 * Decrypts a provider's token
 */
export function decryptProviderToken(config: GitProviderConfig): string {
  return decrypt(config.token);
}

/**
 * Gets cached repositories for a provider
 */
export async function getCachedRepositories(
  userId: string,
  providerId: string
): Promise<string | null> {
  const cacheKey = REDIS_KEYS.repoCache(userId, providerId);
  return redis.get(cacheKey);
}

/**
 * Caches repositories for a provider
 */
export async function cacheRepositories(
  userId: string,
  providerId: string,
  repositories: string
): Promise<void> {
  const cacheKey = REDIS_KEYS.repoCache(userId, providerId);
  await redis.setex(cacheKey, REPO_CACHE_TTL, repositories);
}

/**
 * Clears repository cache for a provider
 */
export async function clearRepositoryCache(userId: string, providerId: string): Promise<void> {
  const cacheKey = REDIS_KEYS.repoCache(userId, providerId);
  await redis.del(cacheKey);
}
