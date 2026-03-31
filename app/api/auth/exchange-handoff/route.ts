import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type HandoffRow = {
  access_token: string;
  refresh_token: string;
  workspace_slug: string | null;
};

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { url, serviceRoleKey };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim();

    if (!code) {
      return NextResponse.json({ error: "Launch code is required." }, { status: 400 });
    }

    const { url, serviceRoleKey } = getConfig();
    const serviceClient = createClient(url, serviceRoleKey);
    const now = new Date().toISOString();

    const { data, error } = await serviceClient
      .from("product_launch_handoffs")
      .update({ consumed_at: now })
      .eq("handoff_code", code)
      .eq("product_key", "reach_canopy")
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("access_token,refresh_token,workspace_slug")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: "Launch code is invalid or expired." }, { status: 400 });
    }

    const handoff = data as HandoffRow;
    return NextResponse.json({
      accessToken: handoff.access_token,
      refreshToken: handoff.refresh_token,
      workspaceSlug: handoff.workspace_slug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to exchange launch code." },
      { status: 500 }
    );
  }
}

