import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createProvider } from "@/lib/git-providers";
import type { Repository } from "@/lib/git-providers";
import {
  getUserGitProviders,
  decryptProviderToken,
  getCachedRepositories,
  cacheRepositories,
} from "@/lib/git-providers/repository";

/**
 * GET /api/repositories
 * Lists all repositories from all verified git providers for the authenticated user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const providers = await getUserGitProviders(session.user.id);

    // Filter to only verified providers
    const verifiedProviders = providers.filter((p) => p.verified);

    if (verifiedProviders.length === 0) {
      return NextResponse.json([]);
    }

    const allRepositories: Repository[] = [];

    // Fetch repositories from each provider (with caching)
    for (const provider of verifiedProviders) {
      try {
        // Check cache first
        const cached = await getCachedRepositories(session.user.id, provider.id);

        if (cached) {
          const cachedRepos = JSON.parse(cached) as Repository[];
          allRepositories.push(...cachedRepos);
          continue;
        }

        // Fetch from API
        const token = decryptProviderToken(provider);
        const gitProvider = createProvider(provider.type, provider.url);
        const repos = await gitProvider.listRepositories(token);

        // Add provider ID to each repository
        const reposWithProvider = repos.map((repo) => ({
          ...repo,
          providerId: provider.id,
        }));

        // Cache the results
        await cacheRepositories(session.user.id, provider.id, JSON.stringify(reposWithProvider));

        allRepositories.push(...reposWithProvider);
      } catch (error) {
        console.error(`[repositories] Error fetching from provider ${provider.id}:`, error);
        // Continue with other providers
      }
    }

    // Sort by full name
    allRepositories.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json(allRepositories);
  } catch (error) {
    console.error("[repositories] Error listing repositories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
