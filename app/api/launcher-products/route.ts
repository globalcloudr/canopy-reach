import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceAccess, toErrorResponse } from "@/lib/server-auth";

type LauncherProductKey = "photovault" | "stories_canopy" | "reach_canopy" | "community_canopy";

type EntitlementRow = {
  workspace_id?: string | null;
  organization_id?: string | null;
  org_id?: string | null;
  product_key?: string | null;
  status?: string | null;
  setup_state?: string | null;
};

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { url, serviceRoleKey };
}

function isLauncherProductKey(value: string | null | undefined): value is LauncherProductKey {
  return value === "photovault" || value === "stories_canopy" || value === "reach_canopy" || value === "community_canopy";
}

function canLaunchProduct(row: EntitlementRow) {
  const status = row.status ?? "active";
  const setupState = row.setup_state ?? "ready";

  if (status === "paused" || status === "pilot") {
    return false;
  }

  if (setupState === "in_setup" || setupState === "blocked") {
    return false;
  }

  return true;
}

async function getLaunchableProducts(workspaceId: string): Promise<LauncherProductKey[]> {
  const { url, serviceRoleKey } = getConfig();
  const serviceClient = createClient(url, serviceRoleKey);
  const attempts = [
    { select: "organization_id,product_key,status,setup_state", column: "organization_id" },
    { select: "org_id,product_key,status,setup_state", column: "org_id" },
    { select: "workspace_id,product_key,status,setup_state", column: "workspace_id" },
  ] as const;

  const products = new Set<LauncherProductKey>();

  for (const attempt of attempts) {
    const { data, error } = await serviceClient
      .from("product_entitlements")
      .select(attempt.select)
      .eq(attempt.column, workspaceId);

    if (error) {
      if (
        error.message.includes("product_entitlements") ||
        error.message.includes("workspace_id") ||
        error.message.includes("organization_id") ||
        error.message.includes("org_id")
      ) {
        continue;
      }

      throw new Error(error.message);
    }

    for (const productKey of (((data as EntitlementRow[] | null) ?? [])
      .flatMap((row) => (isLauncherProductKey(row.product_key) && canLaunchProduct(row) ? [row.product_key] : [])))) {
      products.add(productKey);
    }
  }

  return [...products];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId")?.trim();

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  try {
    await requireWorkspaceAccess(request, workspaceId);
    const products = await getLaunchableProducts(workspaceId);
    return NextResponse.json({ products });
  } catch (error) {
    return toErrorResponse(error, "Failed to load launcher products.");
  }
}
