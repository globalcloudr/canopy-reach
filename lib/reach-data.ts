/**
 * Canopy Reach data layer — all Supabase read/write operations.
 * Server-side only. Always scoped by workspace_id.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  ReachIntegration,
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

function toPost(row: PostRow): ReachPost {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    body:          row.body,
    mediaUrl:      row.media_url,
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

/** Get all scheduled posts that are due to be published (across all workspaces). */
export async function getDueScheduledPosts(): Promise<ReachPost[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPost);
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
  return (data ?? []).map(toPost);
}

export async function getPostById(id: string, workspaceId: string): Promise<ReachPost | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reach_posts")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) return null;
  return toPost(data as PostRow);
}

export async function createPost(params: {
  workspaceId: string;
  body:        string;
  mediaUrl?:   string;
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
      media_url:    params.mediaUrl ?? null,
      platforms:    params.platforms,
      status:       params.status,
      scheduled_at: params.scheduledAt ?? null,
      created_by:   params.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toPost(data as PostRow);
}

export async function updatePost(
  id: string,
  workspaceId: string,
  params: {
    body:        string;
    mediaUrl?:   string;
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
      media_url:    params.mediaUrl ?? null,
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
  return toPost(data as PostRow);
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
