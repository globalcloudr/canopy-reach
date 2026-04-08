/**
 * Instagram Graph API client — server-side only.
 * Instagram publishing uses Facebook's Graph API. The user connects a Facebook
 * Page that has a linked Instagram Business or Creator account.
 * Never import this from client components.
 */

const GRAPH_VERSION = "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getConfig() {
  // Instagram OAuth goes through the Facebook app. A workspace can use
  // dedicated IG credentials or fall back to the existing Facebook app.
  const appId = process.env.INSTAGRAM_APP_ID ?? process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET (or FACEBOOK_APP_ID/FACEBOOK_APP_SECRET) must be set"
    );
  }
  return { appId, appSecret };
}

export type InstagramBusinessAccount = {
  igAccountId: string;
  igUsername: string | null;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
};

/** Build the Instagram OAuth URL (uses Facebook OAuth dialog with IG-specific scopes). */
export function getInstagramOAuthUrl(state: string, redirectUri: string): string {
  const { appId } = getConfig();
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ].join(",");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    response_type: "code",
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
    throw new Error(`Instagram token exchange failed: ${body}`);
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
    throw new Error(`Instagram long-lived token exchange failed: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Find the Instagram Business Account linked to the user's Facebook Pages.
 * Iterates through the user's managed pages and returns the first page
 * that has a linked Instagram Business account.
 */
export async function getInstagramBusinessAccount(
  userToken: string
): Promise<InstagramBusinessAccount | null> {
  // Fetch user's Facebook pages with their IG business account info
  const params = new URLSearchParams({
    access_token: userToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });
  const res = await fetch(`${GRAPH_BASE}/me/accounts?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch pages for Instagram: ${body}`);
  }

  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: {
        id: string;
        username?: string;
      };
    }>;
  };

  for (const page of data.data ?? []) {
    if (page.instagram_business_account) {
      return {
        igAccountId: page.instagram_business_account.id,
        igUsername: page.instagram_business_account.username ?? null,
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
      };
    }
  }

  return null;
}

/**
 * Publish a post to Instagram.
 * Instagram requires a two-step process:
 * 1. Create a media container (image required — Instagram does not support text-only posts)
 * 2. Publish the container
 *
 * The imageUrl must be publicly accessible so Instagram's servers can fetch it.
 */
export async function publishToInstagram(
  igAccountId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<string> {
  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    access_token: accessToken,
    image_url: imageUrl,
    caption,
  });

  const containerRes = await fetch(`${GRAPH_BASE}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: containerParams.toString(),
  });

  if (!containerRes.ok) {
    const body = await containerRes.text().catch(() => "");
    throw new Error(`Instagram media container creation failed: ${body}`);
  }

  const containerData = (await containerRes.json()) as { id: string };
  const containerId = containerData.id;

  // Step 2: Publish the container
  const publishParams = new URLSearchParams({
    access_token: accessToken,
    creation_id: containerId,
  });

  const publishRes = await fetch(`${GRAPH_BASE}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishParams.toString(),
  });

  if (!publishRes.ok) {
    const body = await publishRes.text().catch(() => "");
    throw new Error(`Instagram publish failed: ${body}`);
  }

  const publishData = (await publishRes.json()) as { id: string };
  return publishData.id;
}
