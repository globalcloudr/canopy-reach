import { NextResponse } from "next/server";
import { getTemplates } from "@/lib/reach-data";
import { requireWorkspaceAccess, toErrorResponse } from "@/lib/server-auth";

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
