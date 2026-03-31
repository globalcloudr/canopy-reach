// ─── Platform ─────────────────────────────────────────────────────────────────

export type ReachPlatform = "facebook" | "instagram" | "linkedin" | "x";

export const REACH_PLATFORMS: ReachPlatform[] = ["facebook", "instagram", "linkedin", "x"];

export const PLATFORM_LABELS: Record<ReachPlatform, string> = {
  facebook:  "Facebook",
  instagram: "Instagram",
  linkedin:  "LinkedIn",
  x:         "X (Twitter)",
};


// ─── Post status ──────────────────────────────────────────────────────────────

export type ReachPostStatus = "draft" | "scheduled" | "published" | "failed";

// ─── Domain records ───────────────────────────────────────────────────────────

export type ReachIntegration = {
  id:                string;
  workspaceId:       string;
  platform:          ReachPlatform;
  externalAccountId: string;   // Facebook Page ID, etc.
  displayName:       string | null;
  connectedAt:       string;
};

export type PublishResult = {
  platform:  ReachPlatform;
  postId:    string;   // platform-native post ID
  accountId: string;   // Facebook Page ID, etc.
};

export type ReachPost = {
  id:            string;
  workspaceId:   string;
  body:          string;
  mediaUrl:      string | null;
  platforms:     ReachPlatform[];
  status:        ReachPostStatus;
  scheduledAt:   string | null;
  publishedAt:   string | null;
  postizGroupId: string | null;   // repurposed: stores primary fb post ID
  postizResults: PublishResult[] | null;
  createdBy:     string | null;
  createdAt:     string;
  updatedAt:     string;
};

export type ReachGuidelines = {
  id:          string;
  workspaceId: string;
  content:     string;
  updatedAt:   string;
  updatedBy:   string | null;
};

export type ReachTemplate = {
  id:           string;
  workspaceId:  string;
  name:         string;
  templateType: string;
  bodyTemplate: string;
  createdAt:    string;
};

