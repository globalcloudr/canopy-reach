import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserPages,
} from "@/lib/facebook-client";
import { upsertIntegration } from "@/lib/reach-data";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

// GET /api/integrations/connect/facebook?code=...&state=workspaceId
// This is the OAuth callback URL registered in the Facebook app.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");

  const connectUrl = `${APP_URL}/connect`;

  if (error || !code || !workspaceId) {
    const reason = error ?? "Missing code or workspace ID.";
    return NextResponse.redirect(`${connectUrl}?error=${encodeURIComponent(reason)}`);
  }

  try {
    const redirectUri = `${APP_URL}/api/integrations/connect/facebook`;

    // Exchange code → short-lived user token → long-lived user token
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await getLongLivedToken(shortLived);

    // Get pages the user manages
    const pages = await getUserPages(longLived);
    if (pages.length === 0) {
      return NextResponse.redirect(
        `${connectUrl}?error=${encodeURIComponent("No Facebook Pages found. Make sure you manage at least one Page.")}`
      );
    }

    // Use the first page (MVP — single page per workspace)
    const page = pages[0]!;

    await upsertIntegration({
      workspaceId,
      platform:          "facebook",
      externalAccountId: page.id,
      accessToken:       page.access_token,
      displayName:       page.name,
    });

    return NextResponse.redirect(`${connectUrl}?connected=facebook`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed.";
    return NextResponse.redirect(
      `${connectUrl}?error=${encodeURIComponent(message)}`
    );
  }
}
