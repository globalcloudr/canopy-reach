/**
 * Canopy Reach data layer — all Supabase read/write operations.
 * Server-side only. Always scoped by workspace_id.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  ReachIntegration,
  ReachMedia,
  ReachMediaSourceType,
  ReachPost,
  ReachPostStatus,
  ReachGuidelines,
  ReachTemplate,
  ReachPlatform,
  PublishResult,
} from "@/lib/reach-schema";

// ─── Supabase service client ──────────────────────────────────────────────────

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ─── Row types ────────────────────────────────────────────────────────────────

type IntegrationRow = {
  id:                  string;
  workspace_id:        string;
  platform:            string;
  external_account_id: string;
  display_name:        string | null;
  connected_at:        string;
};

type IntegrationTokenRow = IntegrationRow & {
  access_token: string | null;
};

type PostRow = {
  id:              string;
  workspace_id:    string;
  body:            string;
  media_id:        string | null;
  media_url:       string | null;
  platforms:       string[];
  status:          string;
  scheduled_at:    string | null;
  published_at:    string | null;
  external_post_id: string | null;
  publish_results:  PublishResult[] | null;
  created_by:      string | null;
  created_at:      string;
  updated_at:      string;
};

type MediaRow = {
  id:               string;
  workspace_id:     string;
  source_type:      string;
  source_url:       string | null;
  storage_bucket:   string | null;
  storage_path:     string | null;
  original_filename:string | null;
  mime_type:        string | null;
  size_bytes:       number | null;
  created_by:       string | null;
  created_at:       string;
};

type GuidelinesRow = {
  id:           string;
  workspace_id: string;
  content:      string;
  updated_at:   string;
  updated_by:   string | null;
};

type TemplateRow = {
  id:            string;
  workspace_id:  string;
  name:          string;
  template_type: string;
  body_template: string;
  created_at:    string;
};

const REACH_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

// ─── Row → domain mappers ─────────────────────────────────────────────────────

function toIntegration(row: IntegrationRow): ReachIntegration {
  return {
    id:                row.id,
    workspaceId:       row.workspace_id,
    platform:          row.platform as ReachPlatform,
    externalAccountId: row.external_account_id,
    displayName:       row.display_name,
    connectedAt:       row.connected_at,
  };
}

async function buildMediaUrl(row: MediaRow): Promise<string | null> {
  if (row.source_type === "external_url") {
    return row.source_url;
  }

  if (!row.storage_bucket || !row.storage_path) {
    return null;
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, REACH_MEDIA_SIGNED_URL_TTL_SECONDS);
  if (error) {
    throw new Error(error.message);
  }

  return data?.signedUrl ?? null;
}

async function toMedia(row: MediaRow): Promise<ReachMedia> {
  return {
    id:               row.id,
    workspaceId:      row.workspace_id,
    sourceType:       row.source_type as ReachMediaSourceType,
    url:              (await buildMediaUrl(row)) ?? row.source_url ?? "",
    storageBucket:    row.storage_bucket,
    storagePath:      row.storage_path,
    sourceUrl:        row.source_url,
    originalFilename: row.original_filename,
    mimeType:         row.mime_type,
    sizeBytes:        row.size_bytes,
    createdBy:        row.created_by,
    createdAt:        row.created_at,
  };
}

function toPost(row: PostRow, media: ReachMedia | null): ReachPost {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    body:          row.body,
    mediaId:       row.media_id,
    media,
    mediaUrl:      media?.url ?? row.media_url,
    platforms:     row.platforms as ReachPlatform[],
    status:        row.status as ReachPostStatus,
    scheduledAt:   row.scheduled_at,
    publishedAt:   row.published_at,
    externalPostId: row.external_post_id,
    publishResults: (row.publish_results as PublishResult[]) ?? null,
    createdBy:     row.created_by,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

async function attachMedia(rows: PostRow[], workspaceId: string): Promise<ReachPost[]> {
  const mediaIds = [...new Set(rows.map((row) => row.media_id).filter(Boolean))] as string[];
  let mediaMap = new Map<string, ReachMedia>();

  if (mediaIds.length > 0) {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("reach_media")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("id", mediaIds);
    if (error) throw new Error(error.message);
    const media = await Promise.all((data ?? []).map((row) => toMedia(row as MediaRow)));
    mediaMap = new Map(media.map((item) => [item.id, item]));
  }

  return rows.map((row) => toPost(row, row.media_id ? mediaMap.get(row.media_id) ?? null : null));
}

function toGuidelines(row: GuidelinesRow): ReachGuidelines {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    content:     row.content,
    updatedAt:   row.updated_at,
    updatedBy:   row.updated_by,
  };
}

function toTemplate(row: TemplateRow): ReachTemplate {
  return {
    id:           row.id,
    workspaceId:  row.workspace_id,
    name:         row.name,
    templateType: row.template_type,
    bodyTemplate: row.body_template,
    createdAt:    row.created_at,
  };
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export async function getIntegrations(workspaceId: string): Promise<ReachIntegration[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("platform");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toIntegration);
}

export async function getIntegrationById(id: string, workspaceId: string): Promise<ReachIntegration | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_integrations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toIntegration(data as IntegrationRow) : null;
}

export async function upsertIntegration(params: {
  workspaceId:       string;
  platform:          ReachPlatform;
  externalAccountId: string;
  accessToken:       string;
  displayName?:      string;
}): Promise<ReachIntegration> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_integrations")
    .upsert(
      {
        workspace_id:        params.workspaceId,
        platform:            params.platform,
        external_account_id: params.externalAccountId,
        access_token:        params.accessToken,
        display_name:        params.displayName ?? null,
        connected_at:        new Date().toISOString(),
      },
      { onConflict: "workspace_id,platform" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toIntegration(data as IntegrationRow);
}

/**
 * Server-side only — returns integration tokens for publishing.
 * Never expose this data to the client.
 */
export async function getIntegrationTokens(workspaceId: string): Promise<Array<{
  platform:          ReachPlatform;
  externalAccountId: string;
  accessToken:       string | null;
}>> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_integrations")
    .select("platform,external_account_id,access_token")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    platform:          row.platform as ReachPlatform,
    externalAccountId: row.external_account_id as string,
    accessToken:       row.access_token as string | null,
  }));
}

// ─── Media ────────────────────────────────────────────────────────────────────

export async function getMediaById(id: string, workspaceId: string): Promise<ReachMedia | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_media")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toMedia(data as MediaRow) : null;
}

export async function getRecentMedia(workspaceId: string, limit = 12): Promise<ReachMedia[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_media")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map((row) => toMedia(row as MediaRow)));
}

export async function createUploadedMedia(params: {
  workspaceId: string;
  bucket: string;
  path: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdBy?: string | null;
}): Promise<ReachMedia> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_media")
    .insert({
      workspace_id:      params.workspaceId,
      source_type:       "upload",
      storage_bucket:    params.bucket,
      storage_path:      params.path,
      original_filename: params.originalFilename ?? null,
      mime_type:         params.mimeType ?? null,
      size_bytes:        params.sizeBytes ?? null,
      created_by:        params.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toMedia(data as MediaRow);
}

export async function getOrCreateExternalMedia(params: {
  workspaceId: string;
  url: string;
  createdBy?: string | null;
}): Promise<ReachMedia> {
  const supabase = getServiceClient();
  const trimmedUrl = params.url.trim();
  const { data: existing, error: existingError } = await supabase
    .from("reach_media")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("source_type", "external_url")
    .eq("source_url", trimmedUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return toMedia(existing as MediaRow);

  const { data, error } = await supabase
    .from("reach_media")
    .insert({
      workspace_id: params.workspaceId,
      source_type:  "external_url",
      source_url:   trimmedUrl,
      created_by:   params.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toMedia(data as MediaRow);
}

export async function resolvePostMedia(params: {
  workspaceId: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  createdBy?: string | null;
}): Promise<ReachMedia | null> {
  if (params.mediaId?.trim()) {
    const media = await getMediaById(params.mediaId.trim(), params.workspaceId);
    if (!media) {
      throw new Error("Selected media was not found in this workspace.");
    }
    return media;
  }

  if (params.mediaUrl?.trim()) {
    return getOrCreateExternalMedia({
      workspaceId: params.workspaceId,
      url: params.mediaUrl,
      createdBy: params.createdBy ?? null,
    });
  }

  return null;
}

/** Get all scheduled posts that are due to be published (across all workspaces). */
export async function getDueScheduledPosts(): Promise<ReachPost[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PostRow[];
  const workspaceIds = [...new Set(rows.map((row) => row.workspace_id))];
  const postsByWorkspace = await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      const matchingRows = rows.filter((row) => row.workspace_id === workspaceId);
      return attachMedia(matchingRows, workspaceId);
    })
  );
  return postsByWorkspace.flat();
}

export async function deleteIntegration(id: string, workspaceId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("reach_integrations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getPosts(
  workspaceId: string,
  options?: {
    status?: ReachPostStatus;
    from?: string;
    to?: string;
  }
): Promise<ReachPost[]> {
  const supabase = getServiceClient();
  let query = supabase
    .from("reach_posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: true });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.from)   query = query.gte("scheduled_at", options.from);
  if (options?.to)     query = query.lte("scheduled_at", options.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return attachMedia((data ?? []) as PostRow[], workspaceId);
}

export async function getPostById(id: string, workspaceId: string): Promise<ReachPost | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_posts")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  const [post] = await attachMedia([data as PostRow], workspaceId);
  return post ?? null;
}

export async function createPost(params: {
  workspaceId: string;
  body:        string;
  mediaId?:    string | null;
  platforms:   ReachPlatform[];
  status:      ReachPostStatus;
  scheduledAt?: string;
  createdBy?:   string;
}): Promise<ReachPost> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_posts")
    .insert({
      workspace_id: params.workspaceId,
      body:         params.body,
      media_id:     params.mediaId ?? null,
      media_url:    null,
      platforms:    params.platforms,
      status:       params.status,
      scheduled_at: params.scheduledAt ?? null,
      created_by:   params.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const media = params.mediaId ? await getMediaById(params.mediaId, params.workspaceId) : null;
  return toPost(data as PostRow, media);
}

export async function updatePost(
  id: string,
  workspaceId: string,
  params: {
    body:        string;
    mediaId?:    string | null;
    platforms:   ReachPlatform[];
    status:      ReachPostStatus;
    scheduledAt?: string | null;
  }
): Promise<ReachPost> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_posts")
    .update({
      body:         params.body,
      media_id:     params.mediaId ?? null,
      media_url:    null,
      platforms:    params.platforms,
      status:       params.status,
      scheduled_at: params.scheduledAt ?? null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const media = params.mediaId ? await getMediaById(params.mediaId, workspaceId) : null;
  return toPost(data as PostRow, media);
}

export async function updatePostStatus(
  id: string,
  workspaceId: string,
  params: {
    status:          ReachPostStatus;
    externalPostId?: string;
    publishResults?: PublishResult[];
    publishedAt?:    string;
  }
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("reach_posts")
    .update({
      status:           params.status,
      external_post_id: params.externalPostId ?? null,
      publish_results:  params.publishResults ?? null,
      published_at:     params.publishedAt ?? null,
      updated_at:       new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
}

export async function deletePost(id: string, workspaceId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("reach_posts")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
}

// ─── Guidelines ───────────────────────────────────────────────────────────────

export async function getGuidelines(workspaceId: string): Promise<ReachGuidelines | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_guidelines")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();
  if (error) return null;
  return toGuidelines(data as GuidelinesRow);
}

export async function upsertGuidelines(params: {
  workspaceId: string;
  content:     string;
  updatedBy?:  string;
}): Promise<ReachGuidelines> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_guidelines")
    .upsert(
      {
        workspace_id: params.workspaceId,
        content:      params.content,
        updated_at:   new Date().toISOString(),
        updated_by:   params.updatedBy ?? null,
      },
      { onConflict: "workspace_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toGuidelines(data as GuidelinesRow);
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(workspaceId: string): Promise<ReachTemplate[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toTemplate);
}

export async function createTemplate(params: {
  workspaceId:  string;
  name:         string;
  templateType: string;
  bodyTemplate: string;
}): Promise<ReachTemplate> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_templates")
    .insert({
      workspace_id:  params.workspaceId,
      name:          params.name,
      template_type: params.templateType,
      body_template: params.bodyTemplate,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toTemplate(data as TemplateRow);
}

export async function deleteTemplate(id: string, workspaceId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("reach_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
}
