export const REACH_WORKSPACE_ROLES = [
  "owner",
  "admin",
  "staff",
  "uploader",
  "viewer",
  "social_media",
] as const;

export type ReachWorkspaceRole = (typeof REACH_WORKSPACE_ROLES)[number];

export type ReachCapability =
  | "view"
  | "manage_integrations"
  | "create_posts"
  | "edit_posts"
  | "delete_posts"
  | "upload_media"
  | "review_posts"
  | "manage_templates";

const REACH_ROLE_SET = new Set<string>(REACH_WORKSPACE_ROLES);

export function normalizeReachWorkspaceRole(value: string | null | undefined): ReachWorkspaceRole {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized && REACH_ROLE_SET.has(normalized)) {
    return normalized as ReachWorkspaceRole;
  }

  return "viewer";
}

export function hasReachCapability(role: ReachWorkspaceRole, capability: ReachCapability) {
  if (capability === "view") {
    return true;
  }

  if (capability === "manage_integrations" || capability === "review_posts" || capability === "manage_templates") {
    return role === "owner" || role === "admin";
  }

  if (capability === "upload_media") {
    return (
      role === "owner" ||
      role === "admin" ||
      role === "staff" ||
      role === "uploader" ||
      role === "social_media"
    );
  }

  return (
    role === "owner" ||
    role === "admin" ||
    role === "staff" ||
    role === "social_media"
  );
}

export function getReachCapabilityErrorMessage(capability: ReachCapability) {
  switch (capability) {
    case "manage_integrations":
      return "Only workspace owners or admins can manage connected social accounts.";
    case "create_posts":
      return "Your role does not allow creating posts in this workspace.";
    case "edit_posts":
      return "Your role does not allow editing posts in this workspace.";
    case "delete_posts":
      return "Your role does not allow deleting posts in this workspace.";
    case "upload_media":
      return "Your role does not allow uploading media in this workspace.";
    case "review_posts":
      return "Only workspace owners or admins can approve or reject posts.";
    case "manage_templates":
      return "Only workspace owners or admins can manage post templates.";
    default:
      return "You do not have permission to access this workspace.";
  }
}
