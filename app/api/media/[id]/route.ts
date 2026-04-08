import { NextResponse } from "next/server";
import { getMediaById, deleteMedia } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

// DELETE /api/media/[id]?workspaceId=...
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
    const { user } = await requireWorkspaceCapability(request, workspaceId, "upload_media");
    const media = await getMediaById(id, workspaceId);
    if (!media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    await deleteMedia(id, workspaceId);

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_media_deleted",
      entityType: "reach_media",
      entityId: id,
      metadata: {
        sourceType: media.sourceType,
        originalFilename: media.originalFilename,
      },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err, "Failed to delete media.");
  }
}
