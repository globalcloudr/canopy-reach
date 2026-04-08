import { NextResponse } from "next/server";
import { getPostById, updatePostStatus } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

// POST /api/posts/[id]/reject?workspaceId=...
// Body: { reviewNote?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  try {
    const { user } = await requireWorkspaceCapability(request, workspaceId, "review_posts");

    const body = (await request.json().catch(() => ({}))) as { reviewNote?: string };
    const reviewNote = body.reviewNote?.trim() || null;

    const post = await getPostById(id, workspaceId);
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    if (post.status !== "pending_review") {
      return NextResponse.json(
        { error: "Only posts in pending review can be rejected." },
        { status: 400 }
      );
    }

    const reviewedAt = new Date().toISOString();

    await updatePostStatus(id, workspaceId, {
      status:     "draft",
      reviewNote,
      reviewedBy: user.id,
      reviewedAt,
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_post_rejected",
      entityType: "reach_post",
      entityId: id,
      metadata: { hasNote: Boolean(reviewNote) },
    });

    return NextResponse.json({ id, status: "draft" });
  } catch (err) {
    return toErrorResponse(err, "Failed to reject post.");
  }
}
