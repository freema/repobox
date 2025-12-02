import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getGitProvider,
  deleteGitProvider,
  configToResponse,
} from "@/lib/git-providers/repository";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/git-providers/[id]
 * Gets a specific git provider
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const provider = await getGitProvider(session.user.id, id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json(configToResponse(provider));
  } catch (error) {
    console.error("[git-providers] Error getting provider:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/git-providers/[id]
 * Deletes a git provider and clears its cache
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteGitProvider(session.user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    console.log("[git-providers] Deleted provider", {
      userId: session.user.id,
      providerId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[git-providers] Error deleting provider:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
