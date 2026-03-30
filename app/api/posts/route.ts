import { NextResponse } from "next/server";
import { getIntegrations, createPost, getPosts } from "@/lib/reach-data";
import { createPost as postizCreatePost, uploadFromUrl } from "@/lib/postiz-client";
import type { ReachPlatform, PostizPostType, ReachPostStatus } from "@/lib/reach-schema";

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
    // Draft: save to DB only, no Postiz call
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

    // Scheduled or immediate: load integrations and call Postiz
    const integrations = await getIntegrations(workspaceId);
    const integrationMap = Object.fromEntries(
      integrations.map((i) => [i.platform, i.postizIntegrationId])
    );

    const missing = platforms.filter((p) => !integrationMap[p]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `No connected account for: ${missing.join(", ")}. Connect accounts first.` },
        { status: 400 }
      );
    }

    // Upload media to Postiz if provided
    let postizMediaUrl: string | undefined;
    if (body.mediaUrl) {
      postizMediaUrl = await uploadFromUrl(body.mediaUrl);
    }

    // Build Postiz post type
    const postizType: PostizPostType = postType === "now" ? "now" : "schedule";

    // Create post in Postiz
    const results = await postizCreatePost({
      type: postizType,
      date: body.scheduledAt,
      posts: platforms.map((platform) => ({
        integrationId: integrationMap[platform]!,
        platform,
        content:   postBody,
        mediaUrls: postizMediaUrl ? [postizMediaUrl] : [],
      })),
    });

    // Save to DB with Postiz results
    const postizResults = results.map((r, i) => ({
      postId:        r.postId,
      integrationId: r.integration,
      platform:      platforms[i]!,
    }));

    const post = await createPost({
      workspaceId,
      body:          postBody,
      mediaUrl:      postizMediaUrl ?? body.mediaUrl ?? undefined,
      platforms,
      status:        postType === "now" ? "published" : "scheduled",
      scheduledAt:   body.scheduledAt ?? undefined,
    });

    // Update with Postiz results
    const { updatePostStatus } = await import("@/lib/reach-data");
    await updatePostStatus(post.id, workspaceId, {
      status:        postType === "now" ? "published" : "scheduled",
      postizResults,
      publishedAt:   postType === "now" ? new Date().toISOString() : undefined,
    });

    return NextResponse.json({ ...post, postizResults }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create post." },
      { status: 500 }
    );
  }
}
