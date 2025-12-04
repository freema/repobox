import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkSession,
  updateWorkSessionStatus,
  addJobToWorkSession,
  enqueueWorkSessionJob,
} from "@/lib/repositories/work-session";
import { createJob, generateJobId } from "@/lib/repositories";
import type { Job } from "@repobox/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/work-sessions/:id/prompt - Submit a new prompt to the work session
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    const body = await request.json();
    const { prompt, environment } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }

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

    // Can only submit prompts when session is ready
    if (workSession.status !== "ready") {
      return NextResponse.json(
        { error: `Cannot submit prompt: session is ${workSession.status}` },
        { status: 400 }
      );
    }

    // Create job for this prompt
    const jobId = generateJobId();
    const now = Date.now();

    const job: Job = {
      id: jobId,
      userId: session.user.id,
      providerId: workSession.providerId,
      sessionId: sessionId,
      repoUrl: workSession.repoUrl,
      repoName: workSession.repoName,
      branch: workSession.workBranch,
      prompt,
      environment: environment || "default",
      status: "pending",
      linesAdded: 0,
      linesRemoved: 0,
      createdAt: now,
    };

    // Save job
    await createJob(job);

    // Add job to session's job list
    await addJobToWorkSession(sessionId, jobId);

    // Update session status to running
    await updateWorkSessionStatus(sessionId, "running");

    // Enqueue job task for runner
    await enqueueWorkSessionJob({
      sessionId,
      jobId,
      userId: session.user.id,
      prompt,
      environment: environment || "default",
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("[api/work-sessions/:id/prompt] Failed to submit prompt:", error);
    return NextResponse.json(
      { error: "Failed to submit prompt" },
      { status: 500 }
    );
  }
}
