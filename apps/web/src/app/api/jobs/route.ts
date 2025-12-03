import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createJob,
  enqueueJob,
  generateJobId,
  getUserJobs,
  getUserJobCount,
} from "@/lib/repositories";
import { getGitProvider } from "@/lib/git-providers/repository";
import type { Job } from "@repobox/types";

/**
 * GET /api/jobs - List user's jobs with pagination
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const [jobs, total] = await Promise.all([
      getUserJobs(session.user.id, { offset, limit }),
      getUserJobCount(session.user.id),
    ]);

    return NextResponse.json({
      jobs,
      total,
      hasMore: offset + jobs.length < total,
    });
  } catch (error) {
    console.error("[api/jobs] Failed to fetch jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jobs - Create a new job
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { providerId, repoUrl, repoName, branch, environment, prompt } = body;

    // Validate required fields
    if (!providerId || !repoUrl || !repoName || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Create job
    const jobId = generateJobId();
    const now = Date.now();

    const job: Job = {
      id: jobId,
      userId: session.user.id,
      providerId,
      repoUrl,
      repoName,
      branch: branch || "main",
      prompt,
      environment: environment || "default",
      status: "pending",
      linesAdded: 0,
      linesRemoved: 0,
      createdAt: now,
    };

    // Save job to Redis
    await createJob(job);

    // Enqueue job for runner to process
    await enqueueJob({
      jobId: job.id,
      userId: job.userId,
      providerId: job.providerId,
      repoUrl: job.repoUrl,
      prompt: job.prompt,
      environment: job.environment,
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("[api/jobs] Failed to create job:", error);
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }
}
