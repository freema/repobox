import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkSession,
  getWorkSessionOutput,
  getWorkSessionOutputCount,
} from "@/lib/repositories/work-session";
import type { WorkSessionStatus } from "@repobox/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Terminal states for work sessions
const TERMINAL_STATES: WorkSessionStatus[] = ["pushed", "archived", "failed"];

/**
 * SSE endpoint for streaming work session output
 * GET /api/work-sessions/[id]/stream
 *
 * Events:
 * - status: {status, mrUrl?, mrWarning?, errorMessage?, totalLinesAdded?, totalLinesRemoved?}
 * - output: {timestamp, line, stream}
 * - done: Session reached terminal state
 * - error: Error message
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: sessionId } = await params;
  const workSession = await getWorkSession(sessionId);

  if (!workSession) {
    return new Response("Work session not found", { status: 404 });
  }

  // Authorization check
  if (workSession.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE event
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Controller closed
          closed = true;
        }
      };

      // Send initial status
      sendEvent("status", {
        status: workSession.status,
        mrUrl: workSession.mrUrl,
        mrWarning: workSession.mrWarning,
        errorMessage: workSession.errorMessage,
        lastJobStatus: workSession.lastJobStatus,
        totalLinesAdded: workSession.totalLinesAdded,
        totalLinesRemoved: workSession.totalLinesRemoved,
        jobCount: workSession.jobCount,
        workBranch: workSession.workBranch,
        lastActivityAt: workSession.lastActivityAt,
        pushedAt: workSession.pushedAt,
      });

      // Send existing output lines
      const existingOutput = await getWorkSessionOutput(sessionId);
      for (const line of existingOutput) {
        sendEvent("output", line);
      }

      // If session is already in terminal state, close the stream
      if (TERMINAL_STATES.includes(workSession.status)) {
        sendEvent("done", { status: workSession.status });
        controller.close();
        return;
      }

      // Poll for new output and status updates
      let lastOutputCount = existingOutput.length;
      let lastStatus: WorkSessionStatus = workSession.status;
      const pollInterval = 500; // 500ms polling
      const maxPollTime = 60 * 60 * 1000; // 1 hour max
      const startTime = Date.now();

      const poll = async () => {
        if (closed) return;

        // Check if we've exceeded max poll time
        if (Date.now() - startTime > maxPollTime) {
          sendEvent("error", { message: "Stream timeout" });
          controller.close();
          closed = true;
          return;
        }

        try {
          // Check for new output
          const currentCount = await getWorkSessionOutputCount(sessionId);
          if (currentCount > lastOutputCount) {
            // Fetch only new lines
            const newLines = await getWorkSessionOutput(sessionId, {
              start: lastOutputCount,
              end: currentCount - 1,
            });
            for (const line of newLines) {
              sendEvent("output", line);
            }
            lastOutputCount = currentCount;
          }

          // Check for status change
          const currentSession = await getWorkSession(sessionId);
          if (currentSession && currentSession.status !== lastStatus) {
            lastStatus = currentSession.status;
            sendEvent("status", {
              status: currentSession.status,
              mrUrl: currentSession.mrUrl,
              mrWarning: currentSession.mrWarning,
              errorMessage: currentSession.errorMessage,
              lastJobStatus: currentSession.lastJobStatus,
              totalLinesAdded: currentSession.totalLinesAdded,
              totalLinesRemoved: currentSession.totalLinesRemoved,
              jobCount: currentSession.jobCount,
              workBranch: currentSession.workBranch,
              lastActivityAt: currentSession.lastActivityAt,
              pushedAt: currentSession.pushedAt,
            });

            // If session reached terminal state, close stream
            if (TERMINAL_STATES.includes(currentSession.status)) {
              sendEvent("done", { status: currentSession.status });
              controller.close();
              closed = true;
              return;
            }
          }

          // Continue polling
          if (!closed) {
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          if (!closed) {
            sendEvent("error", {
              message: error instanceof Error ? error.message : "Unknown error",
            });
            controller.close();
            closed = true;
          }
        }
      };

      // Start polling
      setTimeout(poll, pollInterval);
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
