import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/postiz-client";
import type { ReachPlatform } from "@/lib/reach-schema";
import { REACH_PLATFORMS } from "@/lib/reach-schema";

// GET /api/integrations/oauth-url?platform=facebook
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") as ReachPlatform | null;

  if (!platform || !REACH_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Valid platform is required." }, { status: 400 });
  }

  try {
    const url = await getOAuthUrl(platform);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get OAuth URL." },
      { status: 500 }
    );
  }
}
