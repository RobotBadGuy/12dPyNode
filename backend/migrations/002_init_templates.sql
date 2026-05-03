-- PC-202: Server-side workflow templates.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- Templates used to live in the browser's localStorage which meant they were
-- per-machine and disappeared when site data was cleared. They now live in
-- Postgres so users can move between machines and (eventually) share them.
--
-- For now templates are globally readable/writable: there's no `user_id`
-- column because PC-801 (auth) hasn't landed. Once it does, a 003 migration
-- will add `owner_id`, backfill it, and turn RLS on.
--
-- The backend talks to this table with the service role key only, so RLS is
-- left disabled.

create table if not exists public.pynode_templates (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    nodes       jsonb not null,
    edges       jsonb not null,
    viewport    jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Load list is sorted newest-first.
create index if not exists pynode_templates_updated_at_idx
    on public.pynode_templates (updated_at desc);

-- pynode_set_updated_at() is also defined in 001_init_workflow_sessions.sql.
-- We re-emit the `create or replace` here so this migration is runnable
-- standalone — running 001 then 002 is safe because the bodies are identical.
create or replace function public.pynode_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists pynode_templates_set_updated_at
    on public.pynode_templates;

create trigger pynode_templates_set_updated_at
    before update on public.pynode_templates
    for each row
    execute function public.pynode_set_updated_at();
