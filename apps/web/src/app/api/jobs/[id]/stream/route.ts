import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getJob, getJobOutput, getJobOutputCount } from "@/lib/repositories/job";
import type { JobStatus } from "@repobox/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint for streaming job output
 * GET /api/jobs/[id]/stream
 *
 * Events:
 * - status: {status, startedAt?, finishedAt?, errorMessage?}
 * - output: {timestamp, line, stream}
 * - done: Job completed
 * - error: Error message
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: jobId } = await params;
  const job = await getJob(jobId);

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  // Authorization check
  if (job.userId !== session.user.id) {
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
        status: job.status,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        errorMessage: job.errorMessage,
        linesAdded: job.linesAdded,
        linesRemoved: job.linesRemoved,
        mrUrl: job.mrUrl,
        branch: job.branch,
      });

      // Send existing output lines
      const existingOutput = await getJobOutput(jobId);
      for (const line of existingOutput) {
        sendEvent("output", line);
      }

      // If job is already finished, close the stream
      if (job.status === "success" || job.status === "failed" || job.status === "cancelled") {
        sendEvent("done", { status: job.status });
        controller.close();
        return;
      }

      // Poll for new output and status updates
      let lastOutputCount = existingOutput.length;
      let lastStatus: JobStatus = job.status;
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
          const currentCount = await getJobOutputCount(jobId);
          if (currentCount > lastOutputCount) {
            // Fetch only new lines
            const newLines = await getJobOutput(jobId, {
              start: lastOutputCount,
              end: currentCount - 1,
            });
            for (const line of newLines) {
              sendEvent("output", line);
            }
            lastOutputCount = currentCount;
          }

          // Check for status change
          const currentJob = await getJob(jobId);
          if (currentJob && currentJob.status !== lastStatus) {
            lastStatus = currentJob.status;
            sendEvent("status", {
              status: currentJob.status,
              startedAt: currentJob.startedAt,
              finishedAt: currentJob.finishedAt,
              errorMessage: currentJob.errorMessage,
              linesAdded: currentJob.linesAdded,
              linesRemoved: currentJob.linesRemoved,
              mrUrl: currentJob.mrUrl,
              branch: currentJob.branch,
            });

            // If job finished, close stream
            if (
              currentJob.status === "success" ||
              currentJob.status === "failed" ||
              currentJob.status === "cancelled"
            ) {
              sendEvent("done", { status: currentJob.status });
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
            sendEvent("error", { message: error instanceof Error ? error.message : "Unknown error" });
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
