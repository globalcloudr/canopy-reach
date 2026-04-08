/**
 * LinkedIn API client — server-side only.
 * Used for OAuth token exchange, organization lookup, and publishing posts.
 * Never import this from client components.
 */

const LINKEDIN_AUTH_BASE = "https://www.linkedin.com/oauth/v2";
const LINKEDIN_API_BASE = "https://api.linkedin.com";

function getConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export type LinkedInOrganization = {
  id: string;       // numeric org ID
  name: string;
  vanityName?: string;
};

type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
};

/** Build the LinkedIn OAuth authorization URL. */
export function getLinkedInOAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = getConfig();
  const scopes = [
    "w_member_social",
    "r_organization_social",
    "w_organization_social",
    "r_basicprofile",
  ].join(" ");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
  });
  return `${LINKEDIN_AUTH_BASE}/authorization?${params.toString()}`;
}

/** Exchange an authorization code for an access token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const { clientId, clientSecret } = getConfig();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${LINKEDIN_AUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LinkedIn token exchange failed: ${body}`);
  }
  const data = (await res.json()) as LinkedInTokenResponse;
  return data.access_token;
}

/**
 * Fetch LinkedIn organizations the authenticated user administers.
 * Uses the organizationAcls endpoint to find orgs where the user has
 * ADMINISTRATOR role, then fetches org details.
 */
export async function getOrganizations(
  accessToken: string
): Promise<LinkedInOrganization[]> {
  // Step 1: Get organization ACLs for the authenticated user
  const aclRes = await fetch(
    `${LINKEDIN_API_BASE}/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,vanityName)))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );
  if (!aclRes.ok) {
    const body = await aclRes.text().catch(() => "");
    throw new Error(`Failed to fetch LinkedIn organizations: ${body}`);
  }

  const aclData = (await aclRes.json()) as {
    elements?: Array<{
      "organization~"?: {
        id: number;
        localizedName?: string;
        vanityName?: string;
      };
    }>;
  };

  const orgs: LinkedInOrganization[] = [];
  for (const el of aclData.elements ?? []) {
    const org = el["organization~"];
    if (!org) continue;
    orgs.push({
      id: String(org.id),
      name: org.localizedName ?? "LinkedIn Organization",
      vanityName: org.vanityName,
    });
  }
  return orgs;
}

/**
 * Publish a post to a LinkedIn organization page.
 * Uses the LinkedIn Posts API (versioned).
 * For image posts, the mediaUrl must be a publicly accessible URL —
 * LinkedIn will fetch it during publishing.
 */
export async function publishToOrganization(
  orgId: string,
  accessToken: string,
  message: string,
  mediaUrl?: string
): Promise<string> {
  const author = `urn:li:organization:${orgId}`;

  // Build the post body per LinkedIn Posts API spec
  const postBody: Record<string, unknown> = {
    author,
    commentary: message,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
  };

  if (mediaUrl) {
    // For image posts, register the image first then attach it
    const imageUrn = await registerAndUploadImage(orgId, accessToken, mediaUrl);
    postBody.content = {
      media: {
        title: "Post image",
        id: imageUrn,
      },
    };
  }

  const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202401",
    },
    body: JSON.stringify(postBody),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LinkedIn publish failed: ${body}`);
  }

  // LinkedIn returns the post URN in the x-restli-id header
  const postUrn = res.headers.get("x-restli-id") ?? "";
  return postUrn;
}

/**
 * Register an image with LinkedIn and upload it from a URL.
 * Returns the image URN to attach to a post.
 */
async function registerAndUploadImage(
  orgId: string,
  accessToken: string,
  imageUrl: string
): Promise<string> {
  const owner = `urn:li:organization:${orgId}`;

  // Step 1: Register the image upload
  const registerRes = await fetch(`${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202401",
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner },
    }),
  });

  if (!registerRes.ok) {
    const body = await registerRes.text().catch(() => "");
    throw new Error(`LinkedIn image registration failed: ${body}`);
  }

  const registerData = (await registerRes.json()) as {
    value: {
      uploadUrl: string;
      image: string; // image URN
    };
  };

  const { uploadUrl, image: imageUrn } = registerData.value;

  // Step 2: Download the image from the source URL
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to download image for LinkedIn upload: ${imageRes.status}`);
  }
  const imageBuffer = await imageRes.arrayBuffer();

  // Step 3: Upload the image binary to LinkedIn's upload URL
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    throw new Error(`LinkedIn image upload failed: ${body}`);
  }

  return imageUrn;
}
