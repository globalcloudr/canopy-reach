import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getInstagramBusinessAccount,
} from "@/lib/instagram-client";
import { parseSignedOAuthState } from "@/lib/oauth-state";
import { upsertIntegration } from "@/lib/reach-data";
import { RouteAuthError, requireWorkspaceCapability } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

// GET /api/integrations/connect/instagram?code=...&state=...
// OAuth callback for Instagram — uses Facebook OAuth with Instagram scopes.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const signedState = searchParams.get("state");
  const error = searchParams.get("error");

  const connectUrl = `${APP_URL}/connect`;

  if (error || !code || !signedState) {
    const reason = error ?? "Missing code or connection state.";
    return NextResponse.redirect(`${connectUrl}?error=${encodeURIComponent(reason)}`);
  }

  try {
    const { workspaceId, userId } = parseSignedOAuthState(signedState);
    await requireWorkspaceCapability(request, workspaceId, "manage_integrations");
    const redirectUri = `${APP_URL}/api/integrations/connect/instagram`;

    // Exchange code → short-lived → long-lived token
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await getLongLivedToken(shortLived);

    // Find the Instagram Business Account linked to a Facebook Page
    const igAccount = await getInstagramBusinessAccount(longLived);
    if (!igAccount) {
      return NextResponse.redirect(
        `${connectUrl}?error=${encodeURIComponent(
          "No Instagram Business account found. Make sure your Facebook Page is linked to an Instagram Business or Creator account."
        )}`
      );
    }

    // Store the IG account — the page access token is used for publishing
    await upsertIntegration({
      workspaceId,
      platform: "instagram",
      externalAccountId: igAccount.igAccountId,
      accessToken: igAccount.pageAccessToken,
      displayName: igAccount.igUsername
        ? `@${igAccount.igUsername}`
        : igAccount.pageName,
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: userId,
      eventType: "reach_integration_connected",
      entityType: "reach_integration",
      entityId: igAccount.igAccountId,
      metadata: {
        platform: "instagram",
        externalAccountId: igAccount.igAccountId,
        displayName: igAccount.igUsername ?? igAccount.pageName,
        linkedPageId: igAccount.pageId,
      },
    });

    return NextResponse.redirect(`${connectUrl}?connected=instagram`);
  } catch (err) {
    console.error(err);
    const message = err instanceof RouteAuthError ? err.message : "Connection failed.";
    return NextResponse.redirect(
      `${connectUrl}?error=${encodeURIComponent(message)}`
    );
  }
}
