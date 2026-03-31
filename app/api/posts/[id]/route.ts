import { NextResponse } from "next/server";
import { getPostById, deletePost } from "@/lib/reach-data";
import { requireWorkspaceAccess, toErrorResponse } from "@/lib/server-auth";

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
    await requireWorkspaceAccess(request, workspaceId);
    const post = await getPostById(id, workspaceId);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    await deletePost(id, workspaceId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err, "Failed to delete post.");
  }
}
