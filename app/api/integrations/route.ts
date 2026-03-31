import { NextResponse } from "next/server";
import { getIntegrations } from "@/lib/reach-data";
import { requireWorkspaceAccess, toErrorResponse } from "@/lib/server-auth";

// GET /api/integrations?workspaceId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    await requireWorkspaceAccess(request, workspaceId);
    const integrations = await getIntegrations(workspaceId);
    return NextResponse.json(integrations);
  } catch (err) {
    return toErrorResponse(err, "Failed to load integrations.");
  }
}
