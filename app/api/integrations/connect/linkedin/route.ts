import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getOrganizations,
} from "@/lib/linkedin-client";
import { parseSignedOAuthState } from "@/lib/oauth-state";
import { upsertIntegration } from "@/lib/reach-data";
import { RouteAuthError, requireWorkspaceCapability } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

// GET /api/integrations/connect/linkedin?code=...&state=...
// This is the OAuth callback URL registered in the LinkedIn app.
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
    const redirectUri = `${APP_URL}/api/integrations/connect/linkedin`;

    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code, redirectUri);

    // Get organizations the user administers
    const orgs = await getOrganizations(accessToken);
    if (orgs.length === 0) {
      return NextResponse.redirect(
        `${connectUrl}?error=${encodeURIComponent(
          "No LinkedIn organization pages found for this account. Make sure you are an administrator of a LinkedIn Company Page."
        )}`
      );
    }

    // Use the first organization (MVP — single org per workspace)
    const org = orgs[0]!;

    await upsertIntegration({
      workspaceId,
      platform: "linkedin",
      externalAccountId: org.id,
      accessToken,
      displayName: org.name,
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: userId,
      eventType: "reach_integration_connected",
      entityType: "reach_integration",
      entityId: org.id,
      metadata: {
        platform: "linkedin",
        externalAccountId: org.id,
        displayName: org.name,
      },
    });

    return NextResponse.redirect(`${connectUrl}?connected=linkedin`);
  } catch (err) {
    console.error(err);
    const message = err instanceof RouteAuthError ? err.message : "Connection failed.";
    return NextResponse.redirect(
      `${connectUrl}?error=${encodeURIComponent(message)}`
    );
  }
}
