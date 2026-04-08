import { NextResponse } from "next/server";
import { getRecentMedia, searchMedia } from "@/lib/reach-data";
import { requireWorkspaceAccess, toErrorResponse } from "@/lib/server-auth";

// GET /api/media?workspaceId=...&limit=...&offset=...&search=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const requestedLimit = Number(searchParams.get("limit") ?? "24");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 60)
    : 24;

  const requestedOffset = Number(searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(requestedOffset)
    ? Math.max(Math.trunc(requestedOffset), 0)
    : 0;

  const search = searchParams.get("search") ?? "";

  try {
    await requireWorkspaceAccess(request, workspaceId);

    // When no search/offset provided, use the simpler recent-media path for
    // backwards compatibility with the composer (which expects a flat array).
    if (!search && offset === 0 && limit <= 24) {
      const media = await getRecentMedia(workspaceId, limit);
      return NextResponse.json(media);
    }

    const result = await searchMedia(workspaceId, { search, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err, "Failed to load media.");
  }
}
