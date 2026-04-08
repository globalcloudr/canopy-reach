import { NextResponse } from "next/server";
import { updateTemplate, deleteTemplate } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

// PUT /api/templates/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      name?: string;
      templateType?: string;
      bodyTemplate?: string;
    };

    const { workspaceId, name, templateType, bodyTemplate } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    }
    if (!bodyTemplate?.trim()) {
      return NextResponse.json({ error: "Template body is required." }, { status: 400 });
    }

    const { user } = await requireWorkspaceCapability(request, workspaceId, "manage_templates");

    const template = await updateTemplate(id, workspaceId, {
      name: name.trim(),
      templateType: templateType?.trim() || "general",
      bodyTemplate: bodyTemplate.trim(),
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_template_updated",
      entityType: "reach_template",
      entityId: template.id,
      metadata: { name: template.name, templateType: template.templateType },
    });

    return NextResponse.json(template);
  } catch (err) {
    return toErrorResponse(err, "Failed to update template.");
  }
}

// DELETE /api/templates/[id]?workspaceId=...
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
    const { user } = await requireWorkspaceCapability(request, workspaceId, "manage_templates");

    await deleteTemplate(id, workspaceId);

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_template_deleted",
      entityType: "reach_template",
      entityId: id,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err, "Failed to delete template.");
  }
}
