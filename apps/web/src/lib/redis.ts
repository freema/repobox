import Redis, { type RedisOptions } from "ioredis";

const getRedisUrl = (): string => {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }
  return url;
};

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

// Singleton Redis instance
let redisInstance: Redis | null = null;

export const getRedis = (): Redis => {
  if (!redisInstance) {
    redisInstance = new Redis(getRedisUrl(), redisOptions);

    redisInstance.on("error", (err) => {
      console.error("[redis] Connection error:", err.message);
    });

    redisInstance.on("connect", () => {
      console.log("[redis] Connected");
    });

    redisInstance.on("reconnecting", (delay: number) => {
      console.log(`[redis] Reconnecting in ${delay}ms`);
    });
  }

  return redisInstance;
};

// For backwards compatibility
export const redis = getRedis();

// Graceful shutdown helper
export const closeRedis = async (): Promise<void> => {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    console.log("[redis] Connection closed");
  }
};
