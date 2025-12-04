import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkSession,
  enqueueWorkSessionPush,
} from "@/lib/repositories/work-session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/work-sessions/:id/push - Push branch and create MR/PR
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { title, description } = body;

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

    // Can only push when session is ready
    if (workSession.status !== "ready") {
      return NextResponse.json(
        { error: `Cannot push: session is ${workSession.status}` },
        { status: 400 }
      );
    }

    // Must have at least one job completed
    if (workSession.jobCount === 0) {
      return NextResponse.json(
        { error: "Cannot push: no work has been done yet" },
        { status: 400 }
      );
    }

    // Enqueue push task for runner
    await enqueueWorkSessionPush({
      sessionId,
      userId: session.user.id,
      title,
      description,
    });

    return NextResponse.json({
      success: true,
      message: "Push task enqueued",
    });
  } catch (error) {
    console.error("[api/work-sessions/:id/push] Failed to enqueue push:", error);
    return NextResponse.json(
      { error: "Failed to push" },
      { status: 500 }
    );
  }
}
