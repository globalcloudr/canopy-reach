import { NextResponse } from "next/server";
import { getFacebookOAuthUrl } from "@/lib/facebook-client";
import { getLinkedInOAuthUrl } from "@/lib/linkedin-client";
import { getInstagramOAuthUrl } from "@/lib/instagram-client";
import { createSignedOAuthState } from "@/lib/oauth-state";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

// GET /api/integrations/oauth-url?platform=facebook|linkedin|instagram&workspaceId=...
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

  try {
    const { user } = await requireWorkspaceCapability(request, workspaceId, "manage_integrations");
    const state = createSignedOAuthState({ workspaceId, userId: user.id });

    if (platform === "facebook") {
      const redirectUri = `${APP_URL}/api/integrations/connect/facebook`;
      const url = getFacebookOAuthUrl(state, redirectUri);
      return NextResponse.json({ url });
    }

    if (platform === "linkedin") {
      const redirectUri = `${APP_URL}/api/integrations/connect/linkedin`;
      const url = getLinkedInOAuthUrl(state, redirectUri);
      return NextResponse.json({ url });
    }

    if (platform === "instagram") {
      const redirectUri = `${APP_URL}/api/integrations/connect/instagram`;
      const url = getInstagramOAuthUrl(state, redirectUri);
      return NextResponse.json({ url });
    }

    return NextResponse.json(
      { error: `${platform} is not yet supported.` },
      { status: 400 }
    );
  } catch (err) {
    return toErrorResponse(err, "Failed to get OAuth URL.");
  }
}
