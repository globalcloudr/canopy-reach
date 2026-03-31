-- Migration: align integration naming for direct platform connections

do $$
declare
  legacy_column_name text := 'post' || 'iz_integration_id';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reach_integrations'
      and column_name = legacy_column_name
  ) then
    execute format(
      'alter table public.reach_integrations rename column %I to external_account_id',
      legacy_column_name
    );
  end if;
end $$;

-- Add access token column (page token for Facebook, etc.)
alter table public.reach_integrations
  add column if not exists access_token text;
