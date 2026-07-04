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

        // Attempt every platform independently and record each outcome, so a
        // failure is never silently discarded (P0 #5, ui-ux-review-2026-07).
        for (const platform of post.platforms) {
          const integration = tokenMap[platform];
          if (!integration?.accessToken) {
            results.push({
              platform,
              postId: "",
              accountId: "",
              error: `No connected ${platform} account — reconnect it on the Connect page.`,
            });
            continue;
          }

          try {
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
              } else {
                results.push({
                  platform,
                  postId: "",
                  accountId: integration.externalAccountId,
                  error: "Instagram requires an image, and this post has no media attached.",
                });
              }
            }
          } catch (platformError) {
            results.push({
              platform,
              postId: "",
              accountId: integration.externalAccountId,
              error:
                platformError instanceof Error && platformError.message
                  ? platformError.message
                  : `Publishing to ${platform} failed.`,
            });
          }
        }

        const successes = results.filter((r) => !r.error);

        if (successes.length === 0) {
          await updatePostStatus(post.id, post.workspaceId, {
            status: "failed",
            externalPostId: undefined,
            publishResults: results,
            publishedAt: undefined,
          });
          failed.push(post.id);
          continue;
        }

        await updatePostStatus(post.id, post.workspaceId, {
          status:         "published",
          externalPostId: successes[0]?.postId ?? null,
          publishResults: results,
          publishedAt:    new Date().toISOString(),
        });

        processed.push(post.id);
      } catch (err) {
        await updatePostStatus(post.id, post.workspaceId, {
          status: "failed",
          externalPostId: undefined,
          publishResults: [
            {
              platform: post.platforms[0] ?? "facebook",
              postId: "",
              accountId: "",
              error:
                err instanceof Error && err.message
                  ? err.message
                  : "Publishing failed unexpectedly.",
            },
          ],
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
