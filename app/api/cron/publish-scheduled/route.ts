import { NextRequest, NextResponse } from "next/server";
import { getDueScheduledPosts, getIntegrationTokens, updatePostStatus } from "@/lib/reach-data";
import { publishToPage } from "@/lib/facebook-client";
import { publishToOrganization } from "@/lib/linkedin-client";
import { publishToInstagram } from "@/lib/instagram-client";
import type { PublishResult } from "@/lib/reach-schema";

// GET /api/cron/publish-scheduled
// Called by Vercel Cron. Secured by CRON_SECRET header.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron secret is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const posts = await getDueScheduledPosts();
    const processed: string[] = [];
    const failed: string[] = [];

    for (const post of posts) {
      try {
        const tokenRows = await getIntegrationTokens(post.workspaceId);
        const tokenMap = Object.fromEntries(tokenRows.map((r) => [r.platform, r]));
        const results: PublishResult[] = [];

        for (const platform of post.platforms) {
          const integration = tokenMap[platform];
          if (!integration?.accessToken) continue;

          if (platform === "facebook") {
            const fbPostId = await publishToPage(
              integration.externalAccountId,
              integration.accessToken,
              post.body,
              post.mediaUrl ?? undefined
            );
            results.push({ platform, postId: fbPostId, accountId: integration.externalAccountId });
          } else if (platform === "linkedin") {
            const liPostUrn = await publishToOrganization(
              integration.externalAccountId,
              integration.accessToken,
              post.body,
              post.mediaUrl ?? undefined
            );
            results.push({ platform, postId: liPostUrn, accountId: integration.externalAccountId });
          } else if (platform === "instagram") {
            if (post.mediaUrl) {
              const igPostId = await publishToInstagram(
                integration.externalAccountId,
                integration.accessToken,
                post.body,
                post.mediaUrl
              );
              results.push({ platform, postId: igPostId, accountId: integration.externalAccountId });
            }
            // Instagram requires an image — skip silently if no media attached
          }
        }

        if (results.length === 0) {
          throw new Error("No connected integration could publish this post.");
        }

        await updatePostStatus(post.id, post.workspaceId, {
          status:         "published",
          externalPostId: results[0]?.postId ?? null,
          publishResults: results,
          publishedAt:    new Date().toISOString(),
        });

        processed.push(post.id);
      } catch {
        await updatePostStatus(post.id, post.workspaceId, {
          status: "failed",
          externalPostId: undefined,
          publishResults: [],
          publishedAt: undefined,
        });
        failed.push(post.id);
      }
    }

    return NextResponse.json({ processed, failed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed." },
      { status: 500 }
    );
  }
}
