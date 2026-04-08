import { NextResponse } from "next/server";
import { getPostById, updatePostStatus, getUserEmailById } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";
import { sendPostRejectedEmail } from "@/lib/email-client";

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

    // Notify the post author — fire and forget, never fail the main response.
    if (post.createdBy) {
      getUserEmailById(post.createdBy)
        .then((authorEmail) => {
          if (!authorEmail) return;
          return sendPostRejectedEmail({
            authorEmail,
            postBody:   post.body,
            platforms:  post.platforms,
            postId:     post.id,
            reviewNote,
          });
        })
        .catch((err: unknown) => {
          console.error("[reject] Failed to send rejection email:", err);
        });
    }

    return NextResponse.json({ id, status: "draft" });
  } catch (err) {
    return toErrorResponse(err, "Failed to reject post.");
  }
}
