-- PC-201: Supabase-backed session store
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- All tables for this app are prefixed with `pynode_` so they coexist cleanly
-- with other apps in the same Supabase project.
--
-- The backend talks to this table with the service role key only, so RLS is
-- left disabled. Re-enable it (and add policies) when PC-801 introduces auth.

create table if not exists public.pynode_workflow_sessions (
    id              uuid primary key,
    status          text not null check (status in ('uploaded','processing','completed','error')),
    excel_file      text,
    workflow_graph  jsonb,
    variables       jsonb,
    results         jsonb,
    error           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists pynode_workflow_sessions_created_at_idx
    on public.pynode_workflow_sessions (created_at);

-- Auto-bump updated_at on every UPDATE.
create or replace function public.pynode_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists pynode_workflow_sessions_set_updated_at
    on public.pynode_workflow_sessions;

create trigger pynode_workflow_sessions_set_updated_at
    before update on public.pynode_workflow_sessions
    for each row
    execute function public.pynode_set_updated_at();
