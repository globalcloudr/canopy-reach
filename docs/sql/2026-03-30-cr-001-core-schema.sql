create extension if not exists pgcrypto;

-- Social account connections per workspace, mapped to platform-native account IDs
create table if not exists public.reach_integrations (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.organizations(id) on delete cascade,
  platform              text not null check (platform in ('facebook', 'instagram', 'linkedin', 'x')),
  external_account_id   text not null,
  display_name          text,
  connected_at          timestamptz not null default now(),
  unique (workspace_id, platform)
);

create index if not exists reach_integrations_workspace_idx on public.reach_integrations (workspace_id);

-- Post records — one row per composed post, tracks publication state
create table if not exists public.reach_posts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.organizations(id) on delete cascade,
  body             text not null,
  media_url        text,
  platforms        text[] not null default '{}',
  status           text not null default 'draft'
                     check (status in ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at     timestamptz,
  published_at     timestamptz,
  external_post_id text,
  publish_results  jsonb,   -- array of {postId, accountId, platform}
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists reach_posts_workspace_idx on public.reach_posts (workspace_id);
create index if not exists reach_posts_status_idx    on public.reach_posts (workspace_id, status);
create index if not exists reach_posts_scheduled_idx on public.reach_posts (workspace_id, scheduled_at);

-- Per-workspace social media guidelines (one row per workspace)
create table if not exists public.reach_guidelines (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.organizations(id) on delete cascade,
  content      text not null default '',
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

-- Per-workspace post templates (Canopy-managed at MVP)
create table if not exists public.reach_templates (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  template_type text not null default 'custom',
  body_template text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists reach_templates_workspace_idx on public.reach_templates (workspace_id);

alter table public.reach_integrations enable row level security;
alter table public.reach_posts        enable row level security;
alter table public.reach_guidelines   enable row level security;
alter table public.reach_templates    enable row level security;
