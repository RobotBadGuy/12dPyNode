-- PC-203: Workflow template versioning.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- Every save (POST /api/templates or PUT /api/templates/{id}) snapshots the
-- full graph into this sibling table so users can browse history and revert
-- to a previous save. Versions are append-only — restoring just creates a
-- newer version on top of the old one.
--
-- The `author` column is left nullable; PC-801 (auth) will start populating it
-- with the user's id. Until then it stays NULL.
--
-- The backend talks to this table with the service role key only, so RLS is
-- left disabled. Re-enable it (and add policies) when PC-801 introduces auth.

create table if not exists public.pynode_template_versions (
    id              uuid primary key default gen_random_uuid(),
    template_id     uuid not null references public.pynode_templates(id) on delete cascade,
    version_number  integer not null check (version_number > 0),
    name            text not null,
    nodes           jsonb not null,
    edges           jsonb not null,
    viewport        jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
    message         text,
    author          text,
    created_at      timestamptz not null default now(),
    unique (template_id, version_number)
);

-- Versions are listed newest-first per template.
create index if not exists pynode_template_versions_lookup_idx
    on public.pynode_template_versions (template_id, version_number desc);

-- Backfill: every pre-existing template becomes its own v1 so the history
-- starts somewhere instead of being empty for templates created before this
-- migration ran. Idempotent — only inserts where no version exists yet.
insert into public.pynode_template_versions
    (template_id, version_number, name, nodes, edges, viewport, created_at)
select t.id, 1, t.name, t.nodes, t.edges, t.viewport, t.created_at
  from public.pynode_templates t
 where not exists (
     select 1
       from public.pynode_template_versions v
      where v.template_id = t.id
 );
