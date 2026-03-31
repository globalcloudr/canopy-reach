import { NextResponse } from "next/server";
import { deleteIntegration } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";

// DELETE /api/integrations/[id]?workspaceId=...
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
    await requireWorkspaceCapability(request, workspaceId, "manage_integrations");
    await deleteIntegration(id, workspaceId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err, "Failed to remove integration.");
  }
}
