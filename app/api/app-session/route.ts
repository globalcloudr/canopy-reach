import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestAccess, toErrorResponse } from "@/lib/server-auth";

type OrganizationRow = {
  id: string;
  name: string | null;
  slug: string | null;
};

function formatDisplayName(email: string | null | undefined, fullName: string | null | undefined) {
  const value = fullName?.trim();
  if (value) {
    return value;
  }

  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return "Canopy User";
  }

  return normalizedEmail
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { url, serviceRoleKey };
}

export async function GET(request: Request) {
  try {
    const requestedWorkspaceSlug = new URL(request.url).searchParams.get("workspace")?.trim() || null;
    const access = await getRequestAccess(request);
    const { url, serviceRoleKey } = getConfig();
    const serviceClient = createClient(url, serviceRoleKey);

    let rows: OrganizationRow[] = [];
    if (access.isPlatformOperator) {
      const { data, error } = await serviceClient
        .from("organizations")
        .select("id,name,slug")
        .order("name", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      rows = (data as OrganizationRow[] | null) ?? [];
    } else {
      const workspaceIds = [...new Set(access.memberships.map((membership) => membership.org_id))];
      if (workspaceIds.length > 0) {
        const { data, error } = await serviceClient
          .from("organizations")
          .select("id,name,slug")
          .in("id", workspaceIds)
          .order("name", { ascending: true });

        if (error) {
          throw new Error(error.message);
        }

        rows = (data as OrganizationRow[] | null) ?? [];
      }
    }

    const workspaces = rows
      .filter((row) => row.id && row.slug)
      .map((row) => ({
        id: row.id,
        name: row.name?.trim() || row.slug!,
        slug: row.slug!,
      }));

    const activeWorkspace =
      (requestedWorkspaceSlug
        ? workspaces.find((workspace) => workspace.slug === requestedWorkspaceSlug) ?? null
        : null) ?? workspaces[0] ?? null;

    return NextResponse.json({
      user: {
        id: access.user.id,
        email: access.user.email ?? "",
        displayName: formatDisplayName(
          access.user.email,
          typeof access.user.user_metadata?.full_name === "string"
            ? access.user.user_metadata.full_name
            : typeof access.user.user_metadata?.name === "string"
              ? access.user.user_metadata.name
              : null
        ),
      },
      isPlatformOperator: access.isPlatformOperator,
      workspaces,
      activeWorkspace,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load app session.");
  }
}

