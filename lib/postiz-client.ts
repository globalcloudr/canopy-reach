/**
 * Postiz API client — server-side only.
 * Never import this file from client components.
 *
 * One Postiz workspace is shared across all Canopy schools.
 * Each school's social accounts are separate integrations within that workspace.
 */

import type {
  PostizCreatePostParams,
  PostizPostResult,
  PostizPostAnalytics,
  ReachPlatform,
} from "@/lib/reach-schema";
import { POSTIZ_PLATFORM_TYPE, POSTIZ_OAUTH_SLUG } from "@/lib/reach-schema";

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  const apiKey = process.env.POSTIZ_API_KEY;
  const apiUrl = process.env.POSTIZ_API_URL ?? "https://api.postiz.com/public/v1";
  if (!apiKey) throw new Error("POSTIZ_API_KEY is not set");
  return { apiKey, apiUrl };
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function postizFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { apiKey, apiUrl } = getConfig();
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Postiz API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export type PostizIntegration = {
  id:          string;
  name:        string;
  identifier:  string;
  picture:     string | null;
  disabled:    boolean;
};

/** List all social account integrations connected to the Postiz workspace. */
export async function listIntegrations(): Promise<PostizIntegration[]> {
  const data = await postizFetch<{ integrations: PostizIntegration[] }>("/integrations");
  return data.integrations ?? [];
}

/** Get the OAuth authorization URL to connect a social account for a platform. */
export async function getOAuthUrl(platform: ReachPlatform): Promise<string> {
  const slug = POSTIZ_OAUTH_SLUG[platform];
  const data = await postizFetch<{ url: string }>(`/social/${slug}`);
  return data.url;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

/** Create or schedule a post across one or more platforms. */
export async function createPost(
  params: PostizCreatePostParams
): Promise<PostizPostResult[]> {
  const body = {
    type:      params.type,
    date:      params.date,
    shortLink: false,
    tags:      [],
    posts: params.posts.map((p) => ({
      integration: p.integrationId,
      value: [
        {
          content: p.content,
          id:      crypto.randomUUID(),
          ...(p.mediaUrls?.length ? { image: p.mediaUrls } : {}),
        },
      ],
      settings: {
        __type: POSTIZ_PLATFORM_TYPE[p.platform],
      },
    })),
  };

  return postizFetch<PostizPostResult[]>("/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Fetch posts within a date range (used to populate the content calendar). */
export async function getPostsByDateRange(
  startDate: string,
  endDate: string
): Promise<unknown[]> {
  const params = new URLSearchParams({ startDate, endDate });
  return postizFetch<unknown[]>(`/posts?${params.toString()}`);
}

/** Delete a single post by its Postiz post ID. */
export async function deletePost(postId: string): Promise<void> {
  await postizFetch(`/posts/${postId}`, { method: "DELETE" });
}

/** Delete all posts in a Postiz group (i.e., one multi-platform post). */
export async function deletePostGroup(groupId: string): Promise<void> {
  await postizFetch(`/posts/group/${groupId}`, { method: "DELETE" });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/** Get engagement stats for a published post. Only available after publishing. */
export async function getPostAnalytics(
  postId: string,
  daysBack = 7
): Promise<PostizPostAnalytics> {
  const params = new URLSearchParams({ d: String(daysBack) });
  return postizFetch<PostizPostAnalytics>(
    `/analytics/post/${postId}?${params.toString()}`
  );
}

// ─── Media ────────────────────────────────────────────────────────────────────

/**
 * Import media from an external URL (e.g. a PhotoVault signed URL).
 * Returns the Postiz-hosted media URL to include in posts.
 */
export async function uploadFromUrl(url: string): Promise<string> {
  const data = await postizFetch<{ url: string }>("/upload-from-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  return data.url;
}
