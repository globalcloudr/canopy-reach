import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getGrantedPermissions,
  getLongLivedToken,
  getUserPages,
} from "@/lib/facebook-client";
import { parseSignedOAuthState } from "@/lib/oauth-state";
import { upsertIntegration } from "@/lib/reach-data";
import { RouteAuthError } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

// GET /api/integrations/connect/facebook?code=...&state=workspaceId
// This is the OAuth callback URL registered in the Facebook app.
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
    const redirectUri = `${APP_URL}/api/integrations/connect/facebook`;

    // Exchange code → short-lived user token → long-lived user token
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await getLongLivedToken(shortLived);

    // Get pages the user manages
    const pages = await getUserPages(longLived);
    console.log("[facebook-connect] pages returned:", JSON.stringify(pages));
    if (pages.length === 0) {
      let message = "Facebook returned no manageable Pages for this login. Make sure you signed into the personal Facebook account that has Facebook access to a Page.";

      try {
        const permissions = await getGrantedPermissions(longLived);
        console.log("[facebook-connect] granted permissions:", JSON.stringify(permissions));

        const requiredPermissions = [
          "pages_show_list",
          "pages_manage_posts",
          "pages_read_engagement",
        ];
        const missingPermissions = requiredPermissions.filter(
          (permission) => permissions[permission] !== "granted"
        );

        if (missingPermissions.length > 0) {
          message = `Facebook did not grant the required page permissions: ${missingPermissions.join(", ")}. Please approve them and try again.`;
        }
      } catch (permissionError) {
        console.error("[facebook-connect] failed to inspect permissions", permissionError);
      }

      return NextResponse.redirect(
        `${connectUrl}?error=${encodeURIComponent(message)}`
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

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: userId,
      eventType: "reach_integration_connected",
      entityType: "reach_integration",
      entityId: page.id,
      metadata: {
        platform: "facebook",
        externalAccountId: page.id,
        displayName: page.name,
      },
    });

    return NextResponse.redirect(`${connectUrl}?connected=facebook`);
  } catch (err) {
    const message =
      err instanceof RouteAuthError || err instanceof Error
        ? err.message
        : "Connection failed.";
    return NextResponse.redirect(
      `${connectUrl}?error=${encodeURIComponent(message)}`
    );
  }
}
