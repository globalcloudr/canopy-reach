import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getReachCapabilityErrorMessage,
  hasReachCapability,
  normalizeReachWorkspaceRole,
  type ReachCapability,
  type ReachWorkspaceRole,
} from "@/lib/reach-permissions";

type ProfileRow = {
  is_super_admin?: boolean | null;
  platform_role?: string | null;
};

type MembershipRow = {
  org_id: string;
  role?: string | null;
};

export class RouteAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { url, anonKey, serviceRoleKey };
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new RouteAuthError(401, "Authentication required.");
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new RouteAuthError(401, "Authentication required.");
  }

  return token;
}

function isPlatformOperator(profile: ProfileRow | null) {
  return (
    profile?.is_super_admin === true ||
    profile?.platform_role === "super_admin" ||
    profile?.platform_role === "platform_staff"
  );
}

export async function requireAuthenticatedUser(request: Request): Promise<{
  user: User;
}> {
  const token = getBearerToken(request);
  const { url, anonKey } = getConfig();
  const authClient = createClient(url, anonKey);

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    throw new RouteAuthError(401, "Authentication required.");
  }

  return { user: data.user };
}

export async function requireWorkspaceAccess(
  request: Request,
  workspaceId: string
): Promise<{
  user: User;
  isPlatformOperator: boolean;
  membershipRole: ReachWorkspaceRole | null;
}> {
  const { user } = await requireAuthenticatedUser(request);
  const { url, serviceRoleKey } = getConfig();
  const serviceClient = createClient(url, serviceRoleKey);

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("is_super_admin,platform_role")
    .eq("user_id", user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    throw new Error(profileError.message);
  }

  const operator = isPlatformOperator((profile as ProfileRow | null) ?? null);
  if (operator) {
    return { user, isPlatformOperator: true, membershipRole: null };
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from("memberships")
    .select("org_id,role")
    .eq("user_id", user.id)
    .eq("org_id", workspaceId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    throw new RouteAuthError(403, "You do not have access to this workspace.");
  }

  return {
    user,
    isPlatformOperator: false,
    membershipRole: normalizeReachWorkspaceRole((membership as MembershipRow).role ?? null),
  };
}

export async function requireWorkspaceCapability(
  request: Request,
  workspaceId: string,
  capability: ReachCapability
) {
  const access = await requireWorkspaceAccess(request, workspaceId);

  if (access.isPlatformOperator) {
    return access;
  }

  if (!access.membershipRole || !hasReachCapability(access.membershipRole, capability)) {
    throw new RouteAuthError(403, getReachCapabilityErrorMessage(capability));
  }

  return access;
}

export function toErrorResponse(err: unknown, fallbackMessage: string) {
  if (err instanceof RouteAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  return NextResponse.json(
    { error: err instanceof Error ? err.message : fallbackMessage },
    { status: 500 }
  );
}
