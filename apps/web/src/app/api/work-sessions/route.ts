import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createWorkSession,
  enqueueWorkSessionInit,
  generateWorkSessionId,
  getUserWorkSessions,
  getUserWorkSessionCount,
} from "@/lib/repositories/work-session";
import { getGitProvider } from "@/lib/git-providers/repository";
import type { WorkSession } from "@repobox/types";

/**
 * GET /api/work-sessions - List user's work sessions with pagination
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const includeArchived = searchParams.get("includeArchived") === "true";

  try {
    const [sessions, total] = await Promise.all([
      getUserWorkSessions(session.user.id, {
        offset,
        limit,
        excludeArchived: !includeArchived
      }),
      getUserWorkSessionCount(session.user.id),
    ]);

    return NextResponse.json({
      sessions,
      total,
      hasMore: offset + sessions.length < total,
    });
  } catch (error) {
    console.error("[api/work-sessions] Failed to fetch sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch work sessions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-sessions - Create a new work session
 * This creates the session and enqueues the init task (clone repo, create branch)
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { providerId, repoUrl, repoName, baseBranch } = body;

    // Validate required fields
    if (!providerId || !repoUrl || !repoName) {
      return NextResponse.json(
        { error: "Missing required fields: providerId, repoUrl, repoName" },
        { status: 400 }
      );
    }

    // Verify provider ownership
    const provider = await getGitProvider(session.user.id, providerId);
    if (!provider) {
      return NextResponse.json(
        { error: "Git provider not found" },
        { status: 404 }
      );
    }

    // Create work session
    const sessionId = generateWorkSessionId();
    const now = Date.now();

    const workSession: WorkSession = {
      id: sessionId,
      userId: session.user.id,
      providerId,
      repoUrl,
      repoName,
      baseBranch: baseBranch || "main",
      workBranch: `repobox/${sessionId.slice(0, 8)}`,
      status: "initializing",
      totalLinesAdded: 0,
      totalLinesRemoved: 0,
      jobCount: 0,
      lastActivityAt: now,
      createdAt: now,
    };

    // Save session to Redis
    await createWorkSession(workSession);

    // Enqueue init task for runner
    await enqueueWorkSessionInit({
      sessionId: workSession.id,
      userId: workSession.userId,
      providerId: workSession.providerId,
      repoUrl: workSession.repoUrl,
      repoName: workSession.repoName,
      baseBranch: workSession.baseBranch,
    });

    return NextResponse.json({ session: workSession }, { status: 201 });
  } catch (error) {
    console.error("[api/work-sessions] Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create work session" },
      { status: 500 }
    );
  }
}
