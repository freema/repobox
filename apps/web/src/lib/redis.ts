import Redis, { type RedisOptions } from "ioredis";

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy: (times: number): number => {
    // Exponential backoff: 50ms, 100ms, 150ms... max 2000ms
    return Math.min(times * 50, 2000);
  },
  reconnectOnError: (err: Error): boolean => {
    const targetErrors = ["READONLY", "ECONNRESET", "ECONNREFUSED"];
    return targetErrors.some((e) => err.message.includes(e));
  },
};

// Store instance in globalThis to persist across hot reloads in development
// This pattern is recommended by Next.js for database connections
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

/**
 * Get or create Redis instance.
 * Uses globalThis to persist connection across hot reloads in development.
 */
export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    globalForRedis.redis = new Redis(url, redisOptions);

    globalForRedis.redis.on("error", (err) => {
      console.error("[redis] Connection error:", err.message);
    });

    globalForRedis.redis.on("connect", () => {
      console.log("[redis] Connected");
    });

    globalForRedis.redis.on("reconnecting", (delay: number) => {
      console.log(`[redis] Reconnecting in ${delay}ms`);
    });
  }

  return globalForRedis.redis;
}

/**
 * Redis instance for use in server components and API routes.
 * Lazily initialized on first property access.
 */
export const redis = new Proxy({} as Redis, {
  get(target, prop, receiver) {
    const instance = getRedis();
    const value = Reflect.get(instance, prop, receiver);
    // Bind methods to the Redis instance
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

/**
 * Graceful shutdown helper
 */
export async function closeRedis(): Promise<void> {
  if (globalForRedis.redis) {
    await globalForRedis.redis.quit();
    globalForRedis.redis = undefined;
    console.log("[redis] Connection closed");
  }
}
