-- Migration: replace Postiz integration IDs with direct social account IDs + tokens

-- Rename postiz_integration_id to external_account_id
alter table public.reach_integrations
  rename column postiz_integration_id to external_account_id;

-- Add access token column (page token for Facebook, etc.)
alter table public.reach_integrations
  add column if not exists access_token text;
