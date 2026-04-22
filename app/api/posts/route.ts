import { NextResponse } from "next/server";
import { logPortalActivity } from "@/lib/portal-activity";
import {
  getIntegrationTokens,
  createPost,
  getPosts,
  resolvePostMedia,
  updatePostStatus,
} from "@/lib/reach-data";
import { publishToPage } from "@/lib/facebook-client";
import { publishToOrganization } from "@/lib/linkedin-client";
import { publishToInstagram } from "@/lib/instagram-client";
import type { ReachPlatform, ReachPostStatus, PublishResult } from "@/lib/reach-schema";
import { requireWorkspaceAccess, requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";
import { sendPostSubmittedEmail, sendNewPendingReviewEmail } from "@/lib/email-client";
import { getAdminEmailsForWorkspace } from "@/lib/reach-data";

// ─── Notification helper ──────────────────────────────────────────────────────

/** Fire-and-forget: send submitted confirmation to author + review alert to admins. */
function fireReviewNotifications(params: {
  workspaceId: string;
  authorEmail: string | null;
  post: { id: string; body: string; platforms: ReachPlatform[] };
}): void {
  const { workspaceId, authorEmail, post } = params;
  Promise.all([
    authorEmail
      ? sendPostSubmittedEmail({ authorEmail, postBody: post.body, platforms: post.platforms })
      : Promise.resolve(),
    getAdminEmailsForWorkspace(workspaceId).then((adminEmails) =>
      sendNewPendingReviewEmail({
        adminEmails,
        authorEmail,
        postBody:  post.body,
        platforms: post.platforms,
        postId:    post.id,
      })
    ),
  ]).catch((err: unknown) => {
    console.error("[posts] Failed to send review notifications:", err);
  });
}

// GET /api/posts?workspaceId=...&status=...&from=...&to=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    await requireWorkspaceAccess(request, workspaceId);

    const status = searchParams.get("status") as ReachPostStatus | null;
    const posts = await getPosts(workspaceId, {
      status: status ?? undefined,
      from:   searchParams.get("from") ?? undefined,
      to:     searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(posts);
  } catch (err) {
    return toErrorResponse(err, "Failed to load posts.");
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
    mediaId?:     string;
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
    const { user, isPlatformOperator, membershipRole } = await requireWorkspaceCapability(request, workspaceId, "create_posts");
    const media = await resolvePostMedia({
      workspaceId,
      mediaId: body.mediaId ?? null,
      mediaUrl: body.mediaUrl ?? null,
      createdBy: user.id,
    });

    // Staff and social_media roles require review before publishing.
    // Platform operators and owner/admin bypass review.
    const requiresReview =
      !isPlatformOperator &&
      (membershipRole === "staff" || membershipRole === "social_media");

    // Draft: save to DB only
    if (postType === "draft") {
      const post = await createPost({
        workspaceId,
        body:      postBody,
        mediaId:   media?.id ?? null,
        platforms,
        status:    "draft",
        createdBy: user.id,
      });
      void logPortalActivity({
        workspace_id: workspaceId,
        product_key:  "reach_canopy",
        event_type:   "draft",
        title:        postBody.length > 60 ? postBody.slice(0, 57) + "…" : postBody,
        description:  platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" · "),
        event_url:    `/auth/launch/reach?path=/posts/${post.id}`,
      });
      await logAuditEvent({
        orgId: workspaceId,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        eventType: "reach_post_created",
        entityType: "reach_post",
        entityId: post.id,
        metadata: {
          status: "draft",
          platforms,
          mediaId: media?.id ?? null,
          hasMedia: Boolean(media),
        },
      });
      return NextResponse.json(post, { status: 201 });
    }

    // Staff submitting a schedule request → pending_review with scheduledAt preserved
    if (postType === "schedule" && requiresReview) {
      const post = await createPost({
        workspaceId,
        body:        postBody,
        mediaId:     media?.id ?? null,
        platforms,
        status:      "pending_review",
        scheduledAt: body.scheduledAt,
        createdBy:   user.id,
      });
      await logAuditEvent({
        orgId: workspaceId,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        eventType: "reach_post_created",
        entityType: "reach_post",
        entityId: post.id,
        metadata: {
          status: "pending_review",
          platforms,
          scheduledAt: body.scheduledAt ?? null,
          mediaId: media?.id ?? null,
          hasMedia: Boolean(media),
        },
      });
      // Notify author (confirmation) + admins (review needed) — fire and forget.
      fireReviewNotifications({ workspaceId, authorEmail: user.email ?? null, post: { id: post.id, body: postBody, platforms } });
      return NextResponse.json(post, { status: 201 });
    }

    // Schedule: save to DB, cron will publish at scheduled_at
    if (postType === "schedule") {
      const post = await createPost({
        workspaceId,
        body:        postBody,
        mediaId:     media?.id ?? null,
        platforms,
        status:      "scheduled",
        scheduledAt: body.scheduledAt,
        createdBy:   user.id,
      });
      void logPortalActivity({
        workspace_id:  workspaceId,
        product_key:   "reach_canopy",
        event_type:    "post_scheduled",
        title:         postBody.length > 60 ? postBody.slice(0, 57) + "…" : postBody,
        description:   platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" · "),
        scheduled_for: body.scheduledAt ?? null,
        event_url:     `/auth/launch/reach?path=/posts/${post.id}`,
      });
      await logAuditEvent({
        orgId: workspaceId,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        eventType: "reach_post_created",
        entityType: "reach_post",
        entityId: post.id,
        metadata: {
          status: "scheduled",
          platforms,
          scheduledAt: body.scheduledAt ?? null,
          mediaId: media?.id ?? null,
          hasMedia: Boolean(media),
        },
      });
      return NextResponse.json(post, { status: 201 });
    }

    // Staff submitting a "post now" request → pending_review (admin will publish)
    if (postType === "now" && requiresReview) {
      const post = await createPost({
        workspaceId,
        body:      postBody,
        mediaId:   media?.id ?? null,
        platforms,
        status:    "pending_review",
        createdBy: user.id,
      });
      await logAuditEvent({
        orgId: workspaceId,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        eventType: "reach_post_created",
        entityType: "reach_post",
        entityId: post.id,
        metadata: {
          status: "pending_review",
          platforms,
          mediaId: media?.id ?? null,
          hasMedia: Boolean(media),
        },
      });
      // Notify author (confirmation) + admins (review needed) — fire and forget.
      fireReviewNotifications({ workspaceId, authorEmail: user.email ?? null, post: { id: post.id, body: postBody, platforms } });
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
          postBody,
          media?.url ?? undefined
        );
        results.push({ platform, postId: fbPostId, accountId: integration.externalAccountId });
      } else if (platform === "linkedin") {
        const liPostUrn = await publishToOrganization(
          integration.externalAccountId,
          integration.accessToken,
          postBody,
          media?.url ?? undefined
        );
        results.push({ platform, postId: liPostUrn, accountId: integration.externalAccountId });
      } else if (platform === "instagram") {
        if (!media?.url) {
          return NextResponse.json(
            { error: "Instagram requires an image. Please attach media before posting." },
            { status: 400 }
          );
        }
        const igPostId = await publishToInstagram(
          integration.externalAccountId,
          integration.accessToken,
          postBody,
          media.url
        );
        results.push({ platform, postId: igPostId, accountId: integration.externalAccountId });
      }
    }

    const post = await createPost({
      workspaceId,
      body:        postBody,
      mediaId:     media?.id ?? null,
      platforms,
      status:      "published",
      scheduledAt: undefined,
      createdBy:   user.id,
    });

    const publishedAt = new Date().toISOString();

    await updatePostStatus(post.id, workspaceId, {
      status:         "published",
      externalPostId: results[0]?.postId ?? null,
      publishResults: results,
      publishedAt,
    });

    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_post_published",
      entityType: "reach_post",
      entityId: post.id,
      metadata: {
        status: "published",
        platforms,
        externalPostId: results[0]?.postId ?? null,
        mediaId: media?.id ?? null,
        hasMedia: Boolean(media),
      },
    });
    void logPortalActivity({
      workspace_id: workspaceId,
      product_key:  "reach_canopy",
      event_type:   "post_published",
      title:        postBody.length > 60 ? postBody.slice(0, 57) + "…" : postBody,
      description:  platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" · "),
      event_url:    `/auth/launch/reach?path=/posts/${post.id}`,
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
    return toErrorResponse(err, "Failed to create post.");
  }
}
