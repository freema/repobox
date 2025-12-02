import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { redis } from "./redis";

// Constants
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// Redis key helpers
const REDIS_KEYS = {
  user: (id: string) => `user:${id}`,
  session: (id: string) => `session:${id}`,
  userSessions: (userId: string) => `user_sessions:${userId}`,
} as const;

// Validation schemas
const OAuthProfileSchema = z.object({
  id: z.string().min(1).max(255),
  email: z.string().email().max(255),
  name: z.string().max(255),
  image: z.string().url().optional(),
});

// User schema as defined in SPEC.MD
interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  auth_provider: "github" | "google" | "ldap";
  created_at: number;
  last_login_at: number;
}

/**
 * Creates or updates user in Redis.
 * Uses SETNX pattern to prevent race conditions.
 */
async function getOrCreateUser(
  profile: z.infer<typeof OAuthProfileSchema>,
  provider: "github" | "google"
): Promise<User> {
  const id = `${provider}:${profile.id}`;
  const userKey = REDIS_KEYS.user(id);
  const now = Date.now();

  // Try to get existing user first
  const existingData = await redis.hgetall(userKey);

  if (existingData && Object.keys(existingData).length > 0) {
    // Update last login atomically
    await redis.hset(userKey, "last_login_at", now);

    return {
      id: existingData.id || id,
      email: existingData.email || profile.email,
      name: existingData.name || profile.name,
      avatar_url: existingData.avatar_url || null,
      auth_provider: (existingData.auth_provider as User["auth_provider"]) || provider,
      created_at: parseInt(existingData.created_at) || now,
      last_login_at: now,
    };
  }

  // Create new user atomically using HSETNX for the id field as a lock
  const wasSet = await redis.hsetnx(userKey, "id", id);

  if (wasSet === 0) {
    // Another process created the user, fetch it
    const userData = await redis.hgetall(userKey);
    await redis.hset(userKey, "last_login_at", now);

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatar_url: userData.avatar_url || null,
      auth_provider: userData.auth_provider as User["auth_provider"],
      created_at: parseInt(userData.created_at),
      last_login_at: now,
    };
  }

  // We won the race, create the full user record
  const user: User = {
    id,
    email: profile.email,
    name: profile.name,
    avatar_url: profile.image || null,
    auth_provider: provider,
    created_at: now,
    last_login_at: now,
  };

  await redis.hset(userKey, {
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url || "",
    auth_provider: user.auth_provider,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  });

  return user;
}

/**
 * Creates a session in Redis for server-side invalidation support.
 */
async function createSession(sessionId: string, userId: string): Promise<void> {
  const sessionKey = REDIS_KEYS.session(sessionId);
  const userSessionsKey = REDIS_KEYS.userSessions(userId);

  // Store session with expiration
  await redis.setex(sessionKey, SESSION_MAX_AGE, userId);

  // Add to user's session set for bulk invalidation
  await redis.sadd(userSessionsKey, sessionId);
  await redis.expire(userSessionsKey, SESSION_MAX_AGE);
}

/**
 * Validates that a session exists in Redis.
 */
async function validateSession(sessionId: string): Promise<string | null> {
  const sessionKey = REDIS_KEYS.session(sessionId);
  return redis.get(sessionKey);
}

/**
 * Invalidates a single session.
 */
async function invalidateSession(sessionId: string, userId: string): Promise<void> {
  const sessionKey = REDIS_KEYS.session(sessionId);
  const userSessionsKey = REDIS_KEYS.userSessions(userId);

  await redis.del(sessionKey);
  await redis.srem(userSessionsKey, sessionId);
}

/**
 * Invalidates all sessions for a user (force logout from all devices).
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  const userSessionsKey = REDIS_KEYS.userSessions(userId);
  const sessionIds = await redis.smembers(userSessionsKey);

  if (sessionIds.length > 0) {
    const sessionKeys = sessionIds.map((id) => REDIS_KEYS.session(id));
    await redis.del(...sessionKeys);
  }

  await redis.del(userSessionsKey);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !profile || !user.email) {
        console.error("[auth] Sign in failed: missing account, profile, or email", {
          hasAccount: !!account,
          hasProfile: !!profile,
          hasEmail: !!user.email,
        });
        return false;
      }

      // Validate input from OAuth provider
      const validationResult = OAuthProfileSchema.safeParse({
        id: account.providerAccountId,
        email: user.email,
        name: user.name || "",
        image: user.image,
      });

      if (!validationResult.success) {
        console.error("[auth] Sign in failed: invalid profile data", {
          provider: account.provider,
          errors: validationResult.error.flatten(),
        });
        return false;
      }

      const provider = account.provider as "github" | "google";

      try {
        await getOrCreateUser(validationResult.data, provider);
        return true;
      } catch (error) {
        console.error("[auth] Sign in failed: Redis error", {
          provider: account.provider,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return false;
      }
    },

    async jwt({ token, account, trigger }) {
      // On initial sign in, create session in Redis
      if (account) {
        const sessionId = crypto.randomUUID();
        const userId = `${account.provider}:${account.providerAccountId}`;

        token.sessionId = sessionId;
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.userId = userId;

        try {
          await createSession(sessionId, userId);
        } catch (error) {
          console.error("[auth] Failed to create session in Redis", {
            userId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Still allow sign in - JWT is the primary session mechanism
        }
      }

      // On session refresh, validate Redis session still exists
      if (trigger === "update" && token.sessionId && token.userId) {
        try {
          const isValid = await validateSession(token.sessionId as string);
          if (!isValid) {
            // Session was invalidated server-side
            return { ...token, error: "SessionInvalidated" };
          }
        } catch (error) {
          console.error("[auth] Failed to validate session", {
            sessionId: token.sessionId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Allow session to continue on Redis errors
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.error === "SessionInvalidated") {
        // Force client to sign out
        throw new Error("Session invalidated");
      }

      if (token.userId) {
        session.user.id = token.userId as string;
      }

      return session;
    },
  },
  events: {
    async signOut(message) {
      // Invalidate session in Redis on sign out
      if ("token" in message && message.token?.sessionId && message.token?.userId) {
        try {
          await invalidateSession(
            message.token.sessionId as string,
            message.token.userId as string
          );
        } catch (error) {
          console.error("[auth] Failed to invalidate session on sign out", {
            sessionId: message.token.sessionId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    },
  },
});
