// ─── Platform ─────────────────────────────────────────────────────────────────

export type ReachPlatform = "facebook" | "instagram" | "linkedin" | "x";

export const REACH_PLATFORMS: ReachPlatform[] = ["facebook", "instagram", "linkedin", "x"];

export const PLATFORM_LABELS: Record<ReachPlatform, string> = {
  facebook:  "Facebook",
  instagram: "Instagram",
  linkedin:  "LinkedIn",
  x:         "X (Twitter)",
};

// Postiz uses these strings in the __type settings field per platform
export const POSTIZ_PLATFORM_TYPE: Record<ReachPlatform, string> = {
  facebook:  "Facebook",
  instagram: "Instagram",
  linkedin:  "LinkedIn",
  x:         "X",
};

// Postiz OAuth integration slug per platform (used in GET /social/{integration})
export const POSTIZ_OAUTH_SLUG: Record<ReachPlatform, string> = {
  facebook:  "FACEBOOK",
  instagram: "INSTAGRAM",
  linkedin:  "LINKEDIN",
  x:         "X",
};

// ─── Post status ──────────────────────────────────────────────────────────────

export type ReachPostStatus = "draft" | "scheduled" | "published" | "failed";

// ─── Domain records ───────────────────────────────────────────────────────────

export type ReachIntegration = {
  id:                  string;
  workspaceId:         string;
  platform:            ReachPlatform;
  postizIntegrationId: string;
  displayName:         string | null;
  connectedAt:         string;
};

export type PostizResult = {
  postId:        string;
  integrationId: string;
  platform:      ReachPlatform;
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
  postizGroupId: string | null;
  postizResults: PostizResult[] | null;
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

// ─── Postiz API types ─────────────────────────────────────────────────────────

export type PostizPostType = "draft" | "schedule" | "now";

export type PostizCreatePostParams = {
  type:        PostizPostType;
  date?:       string;              // ISO-8601, required when type === "schedule"
  posts: Array<{
    integrationId: string;          // Postiz integration ID for this platform
    platform:      ReachPlatform;
    content:       string;
    mediaUrls?:    string[];
  }>;
};

export type PostizPostResult = {
  postId:      string;
  integration: string;
};

export type PostizAnalytics = {
  label:            string;
  data:             number[];
  percentageChange: number;
};

export type PostizPostAnalytics = {
  likes:       PostizAnalytics;
  comments:    PostizAnalytics;
  shares:      PostizAnalytics;
  impressions: PostizAnalytics;
};
