import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJob, getJobOutput } from "@/lib/repositories";

/**
 * GET /api/jobs/[id]/output - Get job output
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  try {
    // Verify job ownership
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get output
    const output = await getJobOutput(jobId);

    return NextResponse.json({ output });
  } catch (error) {
    console.error("[api/jobs/output] Failed to fetch output:", error);
    return NextResponse.json(
      { error: "Failed to fetch output" },
      { status: 500 }
    );
  }
}
