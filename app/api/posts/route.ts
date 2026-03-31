import { NextResponse } from "next/server";
import {
  getIntegrationTokens,
  createPost,
  getPosts,
  updatePostStatus,
} from "@/lib/reach-data";
import { publishToPage } from "@/lib/facebook-client";
import type { ReachPlatform, ReachPostStatus, PublishResult } from "@/lib/reach-schema";

// GET /api/posts?workspaceId=...&status=...&from=...&to=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    const status = searchParams.get("status") as ReachPostStatus | null;
    const posts = await getPosts(workspaceId, {
      status: status ?? undefined,
      from:   searchParams.get("from") ?? undefined,
      to:     searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(posts);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load posts." },
      { status: 500 }
    );
  }
}

// POST /api/posts
export async function POST(request: Request) {
  const body = (await request.json()) as {
    workspaceId?: string;
    postBody?:    string;
    platforms?:   ReachPlatform[];
    postType?:    "now" | "schedule" | "draft";
    scheduledAt?: string;
    mediaUrl?:    string;
  };

  const workspaceId = body.workspaceId?.trim();
  const postBody    = body.postBody?.trim();
  const platforms   = body.platforms;
  const postType    = body.postType ?? "draft";

  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  if (!postBody)    return NextResponse.json({ error: "Post body is required." }, { status: 400 });
  if (!platforms?.length) return NextResponse.json({ error: "Select at least one platform." }, { status: 400 });
  if (postType === "schedule" && !body.scheduledAt) {
    return NextResponse.json({ error: "scheduledAt is required when scheduling." }, { status: 400 });
  }

  try {
    // Draft: save to DB only
    if (postType === "draft") {
      const post = await createPost({
        workspaceId,
        body:      postBody,
        mediaUrl:  body.mediaUrl ?? undefined,
        platforms,
        status:    "draft",
      });
      return NextResponse.json(post, { status: 201 });
    }

    // Schedule: save to DB, cron will publish at scheduled_at
    if (postType === "schedule") {
      const post = await createPost({
        workspaceId,
        body:        postBody,
        mediaUrl:    body.mediaUrl ?? undefined,
        platforms,
        status:      "scheduled",
        scheduledAt: body.scheduledAt,
      });
      return NextResponse.json(post, { status: 201 });
    }

    // Post now: publish directly to each platform
    const tokenRows = await getIntegrationTokens(workspaceId);
    const tokenMap = Object.fromEntries(
      tokenRows.map((r) => [r.platform, r])
    );

    const missing = platforms.filter((p) => !tokenMap[p]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `No connected account for: ${missing.join(", ")}. Connect accounts first.` },
        { status: 400 }
      );
    }

    const results: PublishResult[] = [];

    for (const platform of platforms) {
      const integration = tokenMap[platform]!;
      if (!integration.accessToken) {
        return NextResponse.json(
          { error: `Missing access token for ${platform}. Please reconnect the account.` },
          { status: 400 }
        );
      }

      if (platform === "facebook") {
        const fbPostId = await publishToPage(
          integration.externalAccountId,
          integration.accessToken,
          postBody
        );
        results.push({ platform, postId: fbPostId, accountId: integration.externalAccountId });
      }
      // LinkedIn, X: add here when supported
    }

    const post = await createPost({
      workspaceId,
      body:        postBody,
      mediaUrl:    body.mediaUrl ?? undefined,
      platforms,
      status:      "published",
      scheduledAt: undefined,
    });

    const publishedAt = new Date().toISOString();

    await updatePostStatus(post.id, workspaceId, {
      status:         "published",
      externalPostId: results[0]?.postId ?? null,
      publishResults: results,
      publishedAt,
    });

    return NextResponse.json(
      {
        ...post,
        status: "published",
        externalPostId: results[0]?.postId ?? null,
        publishResults: results,
        publishedAt,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create post." },
      { status: 500 }
    );
  }
}
