import Redis from "ioredis";

const getRedisUrl = () => {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }
  return url;
};

export const redis = new Redis(getRedisUrl(), {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});
