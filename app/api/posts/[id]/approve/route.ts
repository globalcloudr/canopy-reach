import { NextResponse } from "next/server";
import { getPostById, updatePostStatus } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

// POST /api/posts/[id]/approve?workspaceId=...
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

    const post = await getPostById(id, workspaceId);
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    if (post.status !== "pending_review") {
      return NextResponse.json(
        { error: "Only posts in pending review can be approved." },
        { status: 400 }
      );
    }

    // If the post had a scheduled time, move to scheduled; otherwise move to approved.
    const newStatus = post.scheduledAt ? "scheduled" : "approved";
    const reviewedAt = new Date().toISOString();

    await updatePostStatus(id, workspaceId, {
      status:     newStatus,
      reviewedBy: user.id,
      reviewedAt,
      reviewNote: null, // clear any prior rejection note
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_post_approved",
      entityType: "reach_post",
      entityId: id,
      metadata: { newStatus, scheduledAt: post.scheduledAt ?? null },
    });

    return NextResponse.json({ id, status: newStatus });
  } catch (err) {
    return toErrorResponse(err, "Failed to approve post.");
  }
}
