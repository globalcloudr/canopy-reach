import { NextResponse } from "next/server";
import { getTemplates } from "@/lib/reach-data";

// GET /api/templates?workspaceId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    const templates = await getTemplates(workspaceId);
    return NextResponse.json(templates);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load templates." },
      { status: 500 }
    );
  }
}
