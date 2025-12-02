import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createProvider, getDefaultUrl, isValidProviderUrl } from "@/lib/git-providers";
import {
  createGitProvider,
  getUserGitProviders,
  configToResponse,
} from "@/lib/git-providers/repository";
import type { GitProviderType } from "@/lib/git-providers";

const CreateProviderSchema = z.object({
  type: z.enum(["gitlab", "github"]),
  url: z.string().optional(),
  token: z.string().min(1, "Token is required"),
});

/**
 * POST /api/git-providers
 * Creates a new git provider for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = CreateProviderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { type, token } = validation.data;
    const url = validation.data.url || getDefaultUrl(type as GitProviderType);

    // Validate URL format
    if (!isValidProviderUrl(url)) {
      return NextResponse.json({ error: "Invalid provider URL" }, { status: 400 });
    }

    // Verify token with provider
    const provider = createProvider(type as GitProviderType, url);
    const verifyResult = await provider.verifyToken(token);

    if (!verifyResult.valid || !verifyResult.username) {
      return NextResponse.json(
        {
          error: "Token verification failed",
          details: verifyResult.error || "Invalid token",
        },
        { status: 400 }
      );
    }

    // Get repository count for metadata
    let reposCount = 0;
    try {
      const repos = await provider.listRepositories(token);
      reposCount = repos.length;
    } catch (error) {
      console.warn("[git-providers] Failed to count repositories:", error);
      // Continue anyway - token is valid
    }

    // Store provider
    const config = await createGitProvider(session.user.id, {
      type: type as GitProviderType,
      url,
      token,
      username: verifyResult.username,
      verified: true,
      reposCount,
    });

    console.log("[git-providers] Created provider", {
      userId: session.user.id,
      providerId: config.id,
      type,
      url,
    });

    return NextResponse.json(configToResponse(config), { status: 201 });
  } catch (error) {
    console.error("[git-providers] Error creating provider:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/git-providers
 * Lists all git providers for the authenticated user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const providers = await getUserGitProviders(session.user.id);
    const response = providers.map(configToResponse);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[git-providers] Error listing providers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
