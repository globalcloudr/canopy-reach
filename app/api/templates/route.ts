import { NextResponse } from "next/server";
import { getTemplates, createTemplate } from "@/lib/reach-data";
import { requireWorkspaceAccess, requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

// GET /api/templates?workspaceId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    await requireWorkspaceAccess(request, workspaceId);
    const templates = await getTemplates(workspaceId);
    return NextResponse.json(templates);
  } catch (err) {
    return toErrorResponse(err, "Failed to load templates.");
  }
}

// POST /api/templates
export async function POST(request: Request) {
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

    const template = await createTemplate({
      workspaceId,
      name: name.trim(),
      templateType: templateType?.trim() || "general",
      bodyTemplate: bodyTemplate.trim(),
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_template_created",
      entityType: "reach_template",
      entityId: template.id,
      metadata: { name: template.name, templateType: template.templateType },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return toErrorResponse(err, "Failed to create template.");
  }
}
