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
  tasks?: string[];
};

type FacebookPermission = {
  permission: string;
  status: string;
};

type FacebookPublishResponse = {
  id: string;
  post_id?: string;
};

/** Build the Facebook OAuth dialog URL. state encodes workspaceId for the callback. */
export function getFacebookOAuthUrl(state: string, redirectUri: string): string {
  const { appId } = getConfig();
  const scopes = [
    "business_management",
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
    fields: "id,name,access_token,tasks",
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

// ─── Analytics ────────────────────────────────────────────────────────────────

export type PostInsights = {
  impressions: number;
  likes:       number;
  comments:    number;
  shares:      number;
};

/**
 * Fetch engagement insights for a published Facebook post.
 * Uses the Page Insights API. Returns null if insights are not yet available
 * or the post ID is invalid.
 */
export async function getPostInsights(
  postId: string,
  accessToken: string
): Promise<PostInsights | null> {
  const params = new URLSearchParams({
    access_token: accessToken,
    metric: "post_impressions,post_reactions_by_type_total,post_comments,post_shares",
  });

  const res = await fetch(`${GRAPH_BASE}/${postId}/insights?${params.toString()}`);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: Array<{ name: string; values?: Array<{ value: number | Record<string, number> }> }>;
    error?: { message: string };
  };

  if (!data.data || data.error) return null;

  const getValue = (name: string): number => {
    const metric = data.data!.find((m) => m.name === name);
    if (!metric?.values?.[0]) return 0;
    const v = metric.values[0].value;
    if (typeof v === "number") return v;
    // post_reactions_by_type_total returns {LIKE: n, LOVE: n, ...} — sum all
    return Object.values(v as Record<string, number>).reduce((acc, n) => acc + n, 0);
  };

  return {
    impressions: getValue("post_impressions"),
    likes:       getValue("post_reactions_by_type_total"),
    comments:    getValue("post_comments"),
    shares:      getValue("post_shares"),
  };
}

// ─── Publishing ───────────────────────────────────────────────────────────────

/** Publish a text post to a Facebook Page immediately. Returns the Facebook post ID. */
export async function publishToPage(
  pageId: string,
  accessToken: string,
  message: string,
  mediaUrl?: string
): Promise<string> {
  const endpoint = mediaUrl ? `${GRAPH_BASE}/${pageId}/photos` : `${GRAPH_BASE}/${pageId}/feed`;
  const params = new URLSearchParams({
    access_token: accessToken,
  });

  if (mediaUrl) {
    params.set("url", mediaUrl);
    params.set("published", "true");
    if (message.trim()) {
      params.set("caption", message);
    }
  } else {
    params.set("message", message);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Facebook publish failed: ${body}`);
  }
  const data = (await res.json()) as FacebookPublishResponse;
  return data.post_id ?? data.id;
}
