import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createProvider } from "@/lib/git-providers";
import {
  getGitProvider,
  updateProviderVerification,
  decryptProviderToken,
  configToResponse,
} from "@/lib/git-providers/repository";
import { redis } from "@/lib/redis";

type RouteParams = { params: Promise<{ id: string }> };

// Rate limiting: max 5 verifications per minute per user
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 5;

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `rate_limit:verify:${userId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }

  return count <= RATE_LIMIT_MAX;
}

/**
 * POST /api/git-providers/[id]/verify
 * Re-verifies a git provider's token and updates status
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limit
    const allowed = await checkRateLimit(session.user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429 }
      );
    }

    const { id } = await params;
    const provider = await getGitProvider(session.user.id, id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Decrypt token and verify
    const token = decryptProviderToken(provider);
    const gitProvider = createProvider(provider.type, provider.url);
    const verifyResult = await gitProvider.verifyToken(token);

    let reposCount = provider.reposCount;

    if (verifyResult.valid) {
      // Update repo count on successful verification
      try {
        const repos = await gitProvider.listRepositories(token);
        reposCount = repos.length;
      } catch (error) {
        console.warn("[git-providers] Failed to count repositories:", error);
      }
    }

    // Update verification status
    await updateProviderVerification(session.user.id, id, verifyResult.valid, reposCount);

    // Fetch updated provider
    const updatedProvider = await getGitProvider(session.user.id, id);

    console.log("[git-providers] Verified provider", {
      userId: session.user.id,
      providerId: id,
      valid: verifyResult.valid,
    });

    return NextResponse.json({
      ...configToResponse(updatedProvider!),
      verificationResult: {
        valid: verifyResult.valid,
        error: verifyResult.error,
      },
    });
  } catch (error) {
    console.error("[git-providers] Error verifying provider:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
