import { NextResponse } from "next/server";
import { deleteIntegration, getIntegrationById } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

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
    const { user } = await requireWorkspaceCapability(request, workspaceId, "manage_integrations");
    const integration = await getIntegrationById(id, workspaceId);
    if (!integration) {
      return NextResponse.json({ error: "Integration not found." }, { status: 404 });
    }
    await deleteIntegration(id, workspaceId);
    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_integration_disconnected",
      entityType: "reach_integration",
      entityId: integration.id,
      metadata: {
        platform: integration.platform,
        externalAccountId: integration.externalAccountId,
        displayName: integration.displayName,
      },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err, "Failed to remove integration.");
  }
}
