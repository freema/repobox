import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkSession,
  updateWorkSessionStatus,
  getWorkSessionJobIds,
} from "@/lib/repositories/work-session";
import { getJob } from "@/lib/repositories";
import type { Job } from "@repobox/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/work-sessions/:id - Get work session details with jobs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    const workSession = await getWorkSession(sessionId);

    if (!workSession) {
      return NextResponse.json(
        { error: "Work session not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (workSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Get jobs in this session
    const jobIds = await getWorkSessionJobIds(sessionId);
    const jobs: Job[] = [];

    for (const jobId of jobIds) {
      const job = await getJob(jobId);
      if (job) {
        jobs.push(job);
      }
    }

    return NextResponse.json({
      session: workSession,
      jobs,
    });
  } catch (error) {
    console.error("[api/work-sessions/:id] Failed to fetch session:", error);
    return NextResponse.json(
      { error: "Failed to fetch work session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/work-sessions/:id - Archive work session
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    const workSession = await getWorkSession(sessionId);

    if (!workSession) {
      return NextResponse.json(
        { error: "Work session not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (workSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Can only archive if not already archived
    if (workSession.status === "archived") {
      return NextResponse.json(
        { error: "Work session is already archived" },
        { status: 400 }
      );
    }

    // Update status to archived (cleanup will handle workdir deletion)
    await updateWorkSessionStatus(sessionId, "archived");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/work-sessions/:id] Failed to archive session:", error);
    return NextResponse.json(
      { error: "Failed to archive work session" },
      { status: 500 }
    );
  }
}
