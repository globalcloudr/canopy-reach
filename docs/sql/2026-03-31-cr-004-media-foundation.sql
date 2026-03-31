-- Canopy Reach — Media foundation
-- Adds first-class workspace-scoped media records and moves posts to media_id references.

create table if not exists public.reach_media (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.organizations(id) on delete cascade,
  source_type       text not null check (source_type in ('upload', 'external_url')),
  source_url        text,
  storage_bucket    text,
  storage_path      text,
  original_filename text,
  mime_type         text,
  size_bytes        bigint,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  check (
    (source_type = 'upload' and storage_bucket is not null and storage_path is not null)
    or
    (source_type = 'external_url' and source_url is not null)
  )
);

create index if not exists reach_media_workspace_idx on public.reach_media (workspace_id);
create index if not exists reach_media_created_idx on public.reach_media (workspace_id, created_at desc);

alter table public.reach_media enable row level security;

alter table public.reach_posts
  add column if not exists media_id uuid references public.reach_media(id) on delete set null;

create index if not exists reach_posts_media_idx on public.reach_posts (workspace_id, media_id);

with legacy_media as (
  select distinct workspace_id, media_url
  from public.reach_posts
  where media_url is not null
    and media_url <> ''
),
inserted_media as (
  insert into public.reach_media (
    workspace_id,
    source_type,
    source_url,
    created_at
  )
  select
    legacy_media.workspace_id,
    'external_url',
    legacy_media.media_url,
    now()
  from legacy_media
  where not exists (
    select 1
    from public.reach_media existing
    where existing.workspace_id = legacy_media.workspace_id
      and existing.source_type = 'external_url'
      and existing.source_url = legacy_media.media_url
  )
  returning id
)
select count(*) from inserted_media;

update public.reach_posts posts
set media_id = media.id
from public.reach_media media
where posts.media_id is null
  and posts.media_url is not null
  and posts.media_url <> ''
  and media.workspace_id = posts.workspace_id
  and media.source_type = 'external_url'
  and media.source_url = posts.media_url;

-- Keep reach_posts.media_url for transitional backwards compatibility.
-- New application code uses reach_posts.media_id as the canonical media reference.
