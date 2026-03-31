import { NextResponse } from "next/server";
import { getRecentMedia } from "@/lib/reach-data";
import { requireWorkspaceAccess, toErrorResponse } from "@/lib/server-auth";

// GET /api/media?workspaceId=...&limit=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const requestedLimit = Number(searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 24)
    : 12;

  try {
    await requireWorkspaceAccess(request, workspaceId);
    const media = await getRecentMedia(workspaceId, limit);
    return NextResponse.json(media);
  } catch (err) {
    return toErrorResponse(err, "Failed to load media.");
  }
}
