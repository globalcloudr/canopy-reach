"use client";

import { supabase } from "@/lib/supabase-client";
import {
  hasReachCapability,
  normalizeReachWorkspaceRole,
  type ReachWorkspaceRole,
} from "@/lib/reach-permissions";

type ProfileRow = {
  is_super_admin?: boolean | null;
  platform_role?: string | null;
};

type MembershipRow = {
  role?: string | null;
};

export type ReachClientAccess = {
  role: ReachWorkspaceRole | null;
  isPlatformOperator: boolean;
  canManageIntegrations: boolean;
  canCreatePosts: boolean;
  canEditPosts: boolean;
  canDeletePosts: boolean;
  canUploadMedia: boolean;
};

export const DEFAULT_REACH_CLIENT_ACCESS: ReachClientAccess = {
  role: null,
  isPlatformOperator: false,
  canManageIntegrations: false,
  canCreatePosts: false,
  canEditPosts: false,
  canDeletePosts: false,
  canUploadMedia: false,
};

function isPlatformOperator(profile: ProfileRow | null) {
  return (
    profile?.is_super_admin === true ||
    profile?.platform_role === "super_admin" ||
    profile?.platform_role === "platform_staff"
  );
}

export async function getClientWorkspaceAccess(workspaceId: string): Promise<ReachClientAccess> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return DEFAULT_REACH_CLIENT_ACCESS;
  }

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_super_admin,platform_role")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", workspaceId)
      .maybeSingle(),
  ]);

  const profile = (profileResult.data as ProfileRow | null) ?? null;
  const operator = isPlatformOperator(profile);
  const role = membershipResult.data
    ? normalizeReachWorkspaceRole((membershipResult.data as MembershipRow).role ?? null)
    : null;

  const hasCapability = (capability: Parameters<typeof hasReachCapability>[1]) =>
    operator || (role ? hasReachCapability(role, capability) : false);

  return {
    role,
    isPlatformOperator: operator,
    canManageIntegrations: hasCapability("manage_integrations"),
    canCreatePosts: hasCapability("create_posts"),
    canEditPosts: hasCapability("edit_posts"),
    canDeletePosts: hasCapability("delete_posts"),
    canUploadMedia: hasCapability("upload_media"),
  };
}
