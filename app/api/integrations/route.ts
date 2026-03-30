import { NextResponse } from "next/server";
import { getIntegrations } from "@/lib/reach-data";

// GET /api/integrations?workspaceId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    const integrations = await getIntegrations(workspaceId);
    return NextResponse.json(integrations);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load integrations." },
      { status: 500 }
    );
  }
}
