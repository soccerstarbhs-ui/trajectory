-- ============================================================
-- Trajectory — Phase 1 schema: nodes + edges
-- Paste this whole file into Supabase → SQL Editor → New query → Run
-- ============================================================

-- Turn on the extension that lets Postgres generate UUIDs for us
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- NODES: every course, scholarship, lab, professor, club,
-- internship, and goal is a row in this one table.
-- ------------------------------------------------------------
create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'goal',
    'course',
    'extracurricular',
    'scholarship',
    'research_lab',
    'professor',
    'club',
    'internship'
  )),
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  probability_impact numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.nodes.probability_impact is
  'Percentage points this node contributes toward the goal, e.g. 7.00 means +7%';

-- Speed up "give me all courses" / "give me all scholarships" type queries
create index nodes_type_idx on public.nodes (type);

-- ------------------------------------------------------------
-- EDGES: the connections between nodes.
-- ------------------------------------------------------------
create table public.edges (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.nodes(id) on delete cascade,
  target_id uuid not null references public.nodes(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'prerequisite',
    'unlocks',
    'increases_probability',
    'alternative_to'
  )),
  weight numeric(5,2) not null default 1.0,
  created_at timestamptz not null default now(),

  -- a given pair of nodes shouldn't have the exact same relationship twice
  unique (source_id, target_id, relationship_type)
);

-- Speed up "everything connected to node X" queries, both directions
create index edges_source_idx on public.edges (source_id);
create index edges_target_idx on public.edges (target_id);

-- ------------------------------------------------------------
-- Row Level Security: lock down by default, then open read-only
-- access, since this is public demo data (no private user info
-- lives in these two tables). Writing still requires the
-- service_role key (i.e. only your seed script / admin code).
-- ------------------------------------------------------------
alter table public.nodes enable row level security;
alter table public.edges enable row level security;

create policy "Public read access on nodes"
  on public.nodes for select
  to anon
  using (true);

create policy "Public read access on edges"
  on public.edges for select
  to anon
  using (true);

-- No insert/update/delete policies are created for the anon role,
-- so only the service_role key (server-side, never shipped to
-- the browser) can write to these tables. This is intentional.
