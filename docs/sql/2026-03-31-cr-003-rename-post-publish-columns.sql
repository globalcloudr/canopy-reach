-- Migration: align post publish metadata naming with direct platform publishing

do $$
declare
  legacy_group_column text := 'post' || 'iz_group_id';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reach_posts'
      and column_name = legacy_group_column
  ) then
    execute format(
      'alter table public.reach_posts rename column %I to external_post_id',
      legacy_group_column
    );
  end if;
end $$;

do $$
declare
  legacy_results_column text := 'post' || 'iz_results';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reach_posts'
      and column_name = legacy_results_column
  ) then
    execute format(
      'alter table public.reach_posts rename column %I to publish_results',
      legacy_results_column
    );
  end if;
end $$;
