import { NextResponse } from "next/server";
import { logPortalActivity } from "@/lib/portal-activity";
import { getPostById, getIntegrationTokens, updatePostStatus } from "@/lib/reach-data";
import { publishToPage } from "@/lib/facebook-client";
import { publishToOrganization } from "@/lib/linkedin-client";
import { publishToInstagram } from "@/lib/instagram-client";
import type { PublishResult } from "@/lib/reach-schema";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

// POST /api/posts/[id]/publish?workspaceId=...
// Publishes an approved post immediately to all its platforms.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  try {
    const { user } = await requireWorkspaceCapability(request, workspaceId, "create_posts");

    const post = await getPostById(id, workspaceId);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    if (post.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved posts can be published this way." },
        { status: 400 }
      );
    }

    const tokenRows = await getIntegrationTokens(workspaceId);
    const tokenMap = Object.fromEntries(tokenRows.map((r) => [r.platform, r]));

    const missing = post.platforms.filter((p) => !tokenMap[p]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `No connected account for: ${missing.join(", ")}. Connect accounts first.` },
        { status: 400 }
      );
    }

    const results: PublishResult[] = [];
    const mediaUrl = post.mediaUrl ?? undefined;

    for (const platform of post.platforms) {
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
          post.body,
          mediaUrl
        );
        results.push({ platform, postId: fbPostId, accountId: integration.externalAccountId });
      } else if (platform === "linkedin") {
        const liPostUrn = await publishToOrganization(
          integration.externalAccountId,
          integration.accessToken,
          post.body,
          mediaUrl
        );
        results.push({ platform, postId: liPostUrn, accountId: integration.externalAccountId });
      } else if (platform === "instagram") {
        if (!mediaUrl) {
          return NextResponse.json(
            {
              error:
                "Instagram requires an image. Please edit the post to attach media before publishing.",
            },
            { status: 400 }
          );
        }
        const igPostId = await publishToInstagram(
          integration.externalAccountId,
          integration.accessToken,
          post.body,
          mediaUrl
        );
        results.push({ platform, postId: igPostId, accountId: integration.externalAccountId });
      }
    }

    const publishedAt = new Date().toISOString();
    await updatePostStatus(post.id, workspaceId, {
      status:         "published",
      externalPostId: results[0]?.postId ?? null,
      publishResults: results,
      publishedAt,
    });

    await logAuditEvent({
      orgId:        workspaceId,
      actorUserId:  user.id,
      actorEmail:   user.email ?? null,
      eventType:    "reach_post_published",
      entityType:   "reach_post",
      entityId:     post.id,
      metadata: {
        status:         "published",
        platforms:      post.platforms,
        externalPostId: results[0]?.postId ?? null,
        hadMedia:       Boolean(post.mediaUrl),
        publishedFrom:  "approve_flow",
      },
    });

    void logPortalActivity({
      workspace_id: workspaceId,
      product_key:  "reach_canopy",
      event_type:   "post_published",
      title:        post.body.length > 60 ? post.body.slice(0, 57) + "…" : post.body,
      description:  post.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" · "),
      event_url:    `/auth/launch/reach?path=/posts/${post.id}`,
    });

    return NextResponse.json({ success: true, publishedAt });
  } catch (err) {
    return toErrorResponse(err, "Failed to publish post.");
  }
}
