/**
 * Facebook Graph API client — server-side only.
 * Used for OAuth token exchange, page listing, and publishing posts.
 * Never import this from client components.
 */

const GRAPH_VERSION = "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getConfig() {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set");
  }
  return { appId, appSecret };
}

export type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
};

type FacebookPermission = {
  permission: string;
  status: string;
};

/** Build the Facebook OAuth dialog URL. state encodes workspaceId for the callback. */
export function getFacebookOAuthUrl(state: string, redirectUri: string): string {
  const { appId } = getConfig();
  const scopes = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
  ].join(",");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    response_type: "code",
    // Re-request any previously declined page permissions.
    auth_type: "rerequest",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Exchange an auth code for a short-lived user access token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const { appId, appSecret } = getConfig();
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Facebook token exchange failed: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Exchange a short-lived user token for a ~60-day long-lived token. */
export async function getLongLivedToken(shortLivedToken: string): Promise<string> {
  const { appId, appSecret } = getConfig();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Facebook long-lived token exchange failed: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Fetch all Facebook Pages the user manages.
 * Returns page-specific access tokens (non-expiring as long as user is an admin).
 */
export async function getUserPages(userToken: string): Promise<FacebookPage[]> {
  const params = new URLSearchParams({
    access_token: userToken,
    fields: "id,name,access_token",
  });
  const res = await fetch(`${GRAPH_BASE}/me/accounts?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch Facebook pages: ${body}`);
  }
  const data = (await res.json()) as { data?: FacebookPage[]; error?: unknown };
  console.log("[facebook-client] getUserPages raw response:", JSON.stringify(data));
  return data.data ?? [];
}

export async function getGrantedPermissions(userToken: string): Promise<Record<string, string>> {
  const params = new URLSearchParams({ access_token: userToken });
  const res = await fetch(`${GRAPH_BASE}/me/permissions?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch Facebook permissions: ${body}`);
  }

  const data = (await res.json()) as { data?: FacebookPermission[] };
  return Object.fromEntries(
    (data.data ?? []).map((permission) => [permission.permission, permission.status])
  );
}

/** Publish a text post to a Facebook Page immediately. Returns the Facebook post ID. */
export async function publishToPage(
  pageId: string,
  accessToken: string,
  message: string
): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Facebook publish failed: ${body}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}
