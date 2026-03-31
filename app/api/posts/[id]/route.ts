import { NextResponse } from "next/server";
import { getPostById, resolvePostMedia, deletePost, updatePost } from "@/lib/reach-data";
import type { ReachPlatform } from "@/lib/reach-schema";
import { requireWorkspaceAccess, requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

// GET /api/posts/[id]?workspaceId=...
export async function GET(
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
    await requireWorkspaceAccess(request, workspaceId);
    const post = await getPostById(id, workspaceId);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    // Analytics: placeholder — Facebook Insights API integration is a future phase
    return NextResponse.json({ post, analytics: null });
  } catch (err) {
    return toErrorResponse(err, "Failed to load post.");
  }
}

// DELETE /api/posts/[id]?workspaceId=...
export async function DELETE(
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
    const { user } = await requireWorkspaceCapability(request, workspaceId, "delete_posts");
    const post = await getPostById(id, workspaceId);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    await deletePost(id, workspaceId);
    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_post_deleted",
      entityType: "reach_post",
      entityId: post.id,
      metadata: {
        status: post.status,
        platforms: post.platforms,
        hadMedia: Boolean(post.mediaUrl),
      },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err, "Failed to delete post.");
  }
}

// PATCH /api/posts/[id]?workspaceId=...
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const body = (await request.json()) as {
    postBody?: string;
    mediaId?: string;
    mediaUrl?: string;
    platforms?: ReachPlatform[];
    postType?: "schedule" | "draft";
    scheduledAt?: string;
  };

  const postBody = body.postBody?.trim();
  const platforms = body.platforms;
  const postType = body.postType ?? "draft";

  if (!postBody) {
    return NextResponse.json({ error: "Post body is required." }, { status: 400 });
  }
  if (!platforms?.length) {
    return NextResponse.json({ error: "Select at least one platform." }, { status: 400 });
  }
  if (postType === "schedule" && !body.scheduledAt) {
    return NextResponse.json({ error: "scheduledAt is required when scheduling." }, { status: 400 });
  }

  try {
    const { user } = await requireWorkspaceCapability(request, workspaceId, "edit_posts");
    const existing = await getPostById(id, workspaceId);
    if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    if (existing.status === "published") {
      return NextResponse.json({ error: "Published posts cannot be edited." }, { status: 400 });
    }

    const media = await resolvePostMedia({
      workspaceId,
      mediaId: body.mediaId ?? null,
      mediaUrl: body.mediaUrl ?? null,
      createdBy: user.id,
    });

    const post = await updatePost(id, workspaceId, {
      body:        postBody,
      mediaId:     media?.id ?? null,
      platforms,
      status:      postType === "schedule" ? "scheduled" : "draft",
      scheduledAt: postType === "schedule" ? body.scheduledAt ?? null : null,
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_post_updated",
      entityType: "reach_post",
      entityId: post.id,
      metadata: {
        previousStatus: existing.status,
        nextStatus: post.status,
        platforms: post.platforms,
        scheduledAt: post.scheduledAt,
        mediaId: post.mediaId,
        hasMedia: Boolean(post.media),
      },
    });

    return NextResponse.json(post);
  } catch (err) {
    return toErrorResponse(err, "Failed to update post.");
  }
}
