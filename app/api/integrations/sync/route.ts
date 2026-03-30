import { NextResponse } from "next/server";
import { listIntegrations } from "@/lib/postiz-client";
import { upsertIntegration } from "@/lib/reach-data";
import type { ReachPlatform } from "@/lib/reach-schema";
import type { PostizIntegration } from "@/lib/postiz-client";

// Match a Postiz integration to one of our four platforms by inspecting its identifier/name
function detectPlatform(integration: PostizIntegration): ReachPlatform | null {
  const id   = integration.identifier.toLowerCase();
  const name = (integration.name ?? "").toLowerCase();
  if (id.includes("facebook")  || name.includes("facebook"))  return "facebook";
  if (id.includes("instagram") || name.includes("instagram")) return "instagram";
  if (id.includes("linkedin")  || name.includes("linkedin"))  return "linkedin";
  if (id.includes("twitter") || id === "x" || name === "x" || name.includes("twitter")) return "x";
  return null;
}

// POST /api/integrations/sync
// Fetches all integrations from the Postiz workspace, matches them to platforms,
// and upserts into reach_integrations for this workspace.
export async function POST(request: Request) {
  const body = (await request.json()) as { workspaceId?: string };
  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  try {
    const postizIntegrations = await listIntegrations();
    const synced: string[] = [];

    for (const integration of postizIntegrations) {
      if (integration.disabled) continue;
      const platform = detectPlatform(integration);
      if (!platform) continue;

      await upsertIntegration({
        workspaceId,
        platform,
        postizIntegrationId: integration.id,
        displayName: integration.name,
      });
      synced.push(platform);
    }

    return NextResponse.json({ synced });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}
