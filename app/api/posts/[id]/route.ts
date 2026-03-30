import { NextResponse } from "next/server";
import { getPostById, deletePost } from "@/lib/reach-data";
import { getPostAnalytics, deletePost as postizDeletePost, deletePostGroup } from "@/lib/postiz-client";

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
    const post = await getPostById(id, workspaceId);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    // Fetch analytics for published posts
    let analytics = null;
    if (post.status === "published" && post.postizResults?.length) {
      try {
        const firstResult = post.postizResults[0];
        if (firstResult) {
          analytics = await getPostAnalytics(firstResult.postId);
        }
      } catch {
        // Analytics unavailable — continue without them
      }
    }

    return NextResponse.json({ post, analytics });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load post." },
      { status: 500 }
    );
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
    const post = await getPostById(id, workspaceId);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    // Delete from Postiz if it was sent there
    if (post.postizGroupId) {
      try { await deletePostGroup(post.postizGroupId); } catch { /* continue */ }
    } else if (post.postizResults?.length) {
      for (const result of post.postizResults) {
        try { await postizDeletePost(result.postId); } catch { /* continue */ }
      }
    }

    await deletePost(id, workspaceId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete post." },
      { status: 500 }
    );
  }
}
