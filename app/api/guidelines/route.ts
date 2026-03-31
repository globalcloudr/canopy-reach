import { NextResponse } from "next/server";
import { getGuidelines, upsertGuidelines } from "@/lib/reach-data";
import { requireWorkspaceAccess, toErrorResponse } from "@/lib/server-auth";

// GET /api/guidelines?workspaceId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    await requireWorkspaceAccess(request, workspaceId);
    const guidelines = await getGuidelines(workspaceId);
    return NextResponse.json(guidelines);
  } catch (err) {
    return toErrorResponse(err, "Failed to load guidelines.");
  }
}

// POST /api/guidelines
export async function POST(request: Request) {
  const body = (await request.json()) as {
    workspaceId?: string;
    content?:     string;
    updatedBy?:   string;
  };

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  try {
    const { user } = await requireWorkspaceAccess(request, workspaceId);
    const guidelines = await upsertGuidelines({
      workspaceId,
      content:   body.content ?? "",
      updatedBy: user.id,
    });
    return NextResponse.json(guidelines);
  } catch (err) {
    return toErrorResponse(err, "Failed to save guidelines.");
  }
}
