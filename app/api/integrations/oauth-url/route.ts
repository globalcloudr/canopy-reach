import { NextResponse } from "next/server";
import { getFacebookOAuthUrl } from "@/lib/facebook-client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

// GET /api/integrations/oauth-url?platform=facebook&workspaceId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const workspaceId = searchParams.get("workspaceId");

  if (!platform) {
    return NextResponse.json({ error: "platform is required." }, { status: 400 });
  }
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  if (platform === "facebook") {
    try {
      const redirectUri = `${APP_URL}/api/integrations/connect/facebook`;
      const url = getFacebookOAuthUrl(workspaceId, redirectUri);
      return NextResponse.json({ url });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to get OAuth URL." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: `${platform} is not yet supported.` },
    { status: 400 }
  );
}
