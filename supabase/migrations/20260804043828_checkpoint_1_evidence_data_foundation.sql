-- Checkpoint 1: clean the obsolete seed batch and migrate to evidence-backed scoring.
-- The assertions make the approved destructive cleanup fail closed if live data changed.

do $$
declare
  node_total integer;
  edge_total integer;
  node_batches integer;
  edge_batches integer;
begin
  select count(*) into node_total from public.nodes;
  select count(*) into edge_total from public.edges;
  select count(distinct created_at) into node_batches from public.nodes;
  select count(distinct created_at) into edge_batches from public.edges;

  if node_total <> 190 or edge_total <> 152
     or node_batches <> 2 or edge_batches <> 2 then
    raise exception 'Cleanup aborted: expected two complete seed batches (190 nodes, 152 edges).';
  end if;

  if exists (
    select 1 from (
      select created_at, count(*) as row_count
      from public.nodes group by created_at
    ) batches where row_count <> 95
  ) or exists (
    select 1 from (
      select created_at, count(*) as row_count
      from public.edges group by created_at
    ) batches where row_count <> 76
  ) then
    raise exception 'Cleanup aborted: seed batch sizes do not match 95 nodes and 76 edges.';
  end if;
end
$$;

delete from public.nodes
where created_at = (select min(created_at) from public.nodes);

do $$
begin
  if (select count(*) from public.nodes) <> 95
     or (select count(*) from public.edges) <> 76 then
    raise exception 'Cleanup verification failed; rolling back migration.';
  end if;
end
$$;

alter table public.nodes
  drop column probability_impact,
  add column description text,
  add column state_requirements jsonb not null default '{}'::jsonb,
  add column readiness_dimensions text[] not null default '{}'::text[],
  add column updated_at timestamptz not null default now(),
  add constraint nodes_type_name_key unique (type, name);

create index nodes_readiness_dimensions_idx
  on public.nodes using gin (readiness_dimensions);

alter table public.edges
  drop constraint if exists edges_relationship_type_check;

update public.edges
set relationship_type = 'supports'
where relationship_type = 'increases_probability';

alter table public.edges
  drop column weight,
  add column evidence_class text check (evidence_class in ('A', 'B', 'C', 'D', 'E')),
  add column causal_label text not null default 'not_assessed' check (causal_label in (
    'causal', 'associational', 'descriptive', 'institutional_preference',
    'hypothetical', 'not_assessed'
  )),
  add column confidence text not null default 'unknown' check (
    confidence in ('high', 'moderate', 'low', 'unknown')
  ),
  add column population text,
  add column evidence_cycle text,
  add column limitations text,
  add column modeling_rule text,
  add column metadata jsonb not null default '{}'::jsonb,
  add column updated_at timestamptz not null default now(),
  add constraint edges_relationship_type_check check (relationship_type in (
    'prerequisite', 'unlocks', 'enables', 'alternative_to', 'supports',
    'addresses_gap', 'documents_preference', 'hypothetical_effect'
  )),
  add constraint edges_no_self_reference_check check (source_id <> target_id);

create index edges_relationship_type_idx on public.edges (relationship_type);

drop policy if exists "Public read access on nodes" on public.nodes;
drop policy if exists "Public read access on edges" on public.edges;

create table public.evidence_sources (
  source_id text primary key,
  source_tier text not null,
  authors_or_owner text,
  title text not null,
  publication_year integer,
  data_years text,
  source_url text not null,
  methodology text,
  verification_status text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.evidence_records (
  evidence_id text primary key,
  category text not null,
  subcategory text,
  atomic_claim text not null,
  claim_class text not null check (claim_class in ('A', 'B', 'C', 'D', 'E')),
  source_id text not null references public.evidence_sources(source_id),
  source_tier text,
  publication_year integer,
  data_years text,
  population text,
  sample_size integer,
  institution_count integer,
  unit_of_analysis text,
  predictor text,
  outcome text,
  effect_type text,
  effect_size text,
  effect_measure text,
  confidence_interval text,
  p_value text,
  mean numeric,
  median numeric,
  standard_deviation numeric,
  denominator numeric,
  reference_group text,
  covariates text,
  methodology text,
  correlation_or_causation text not null,
  quality_rating text,
  limitations text not null,
  relevance_to_trajectory text,
  model_eligibility text not null,
  exact_locator text,
  source_url text not null,
  verification_status text not null,
  access_date date,
  created_at timestamptz not null default now()
);

create index evidence_records_category_idx
  on public.evidence_records (category);
create index evidence_records_source_idx
  on public.evidence_records (source_id);
create index evidence_records_claim_class_idx
  on public.evidence_records (claim_class);

create table public.edge_evidence (
  edge_id uuid not null references public.edges(id) on delete cascade,
  evidence_id text not null references public.evidence_records(evidence_id) on delete cascade,
  evidence_role text not null default 'supporting' check (
    evidence_role in ('primary', 'supporting', 'context', 'limitation')
  ),
  primary key (edge_id, evidence_id)
);

create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  cumulative_gpa numeric(3,2) check (cumulative_gpa between 0 and 4.33),
  science_gpa numeric(3,2) check (science_gpa between 0 and 4.33),
  mcat_total integer check (mcat_total between 472 and 528),
  academic_state jsonb not null default '{}'::jsonb,
  target_state jsonb not null default '{}'::jsonb,
  timeline jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  missingness jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.student_node_states (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.student_profiles(id) on delete cascade,
  node_id uuid not null references public.nodes(id) on delete cascade,
  status text not null check (status in (
    'completed', 'active', 'anticipated', 'available', 'blocked', 'missing', 'unknown'
  )),
  completed_hours numeric check (completed_hours >= 0),
  anticipated_hours numeric check (anticipated_hours >= 0),
  duration_months numeric check (duration_months >= 0),
  quality_dimensions jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '[]'::jsonb,
  responsibility text,
  reflection text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, node_id)
);

create index student_node_states_profile_idx
  on public.student_node_states (profile_id, status);

create table public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  rubric_key text not null,
  version integer not null check (version > 0),
  label text not null,
  description text not null,
  score_notice text not null,
  is_product_heuristic boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (rubric_key, version)
);

create unique index one_active_rubric_version_idx
  on public.rubric_versions (rubric_key)
  where is_active;

create table public.rubric_components (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.rubric_versions(id) on delete cascade,
  component_key text not null,
  label text not null,
  direction text not null check (direction in ('positive', 'penalty')),
  max_points numeric(5,2) not null check (max_points >= 0),
  description text not null,
  scoring_rule jsonb not null,
  sort_order integer not null,
  unique (rubric_version_id, component_key)
);

create table public.decision_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  rule_type text not null check (rule_type in (
    'redundancy', 'alternative', 'eligibility', 'guardrail'
  )),
  version integer not null default 1,
  definition jsonb not null,
  rationale text not null,
  evidence_boundary text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.rubric_versions (
  rubric_key, version, label, description, score_notice, is_active
) values
  (
    'action_impact', 1, 'Action Impact v1',
    'Ranks currently feasible actions using transparent product-score components.',
    'This is a product heuristic for relative action ranking, not an admissions probability.',
    true
  ),
  (
    'trajectory_readiness', 1, 'Trajectory Readiness v1',
    'Summarizes documented readiness dimensions on a 0–100 product index.',
    'Readiness points are not percentage points and do not estimate acceptance likelihood.',
    true
  );

insert into public.rubric_components (
  rubric_version_id, component_key, label, direction, max_points,
  description, scoring_rule, sort_order
)
select v.id, x.component_key, x.label, x.direction, x.max_points,
       x.description, x.scoring_rule, x.sort_order
from public.rubric_versions v
cross join lateral (
  values
    ('gap_reduction', 'Gap reduction', 'positive', 25::numeric,
     'How directly the action addresses a documented missing or underdeveloped dimension.',
     '{"scale":"ordinal","levels":5}'::jsonb, 1),
    ('downstream_value', 'Downstream value', 'positive', 20::numeric,
     'Verified opportunities, relationships, credentials, or alternatives newly unlocked.',
     '{"scale":"count_banded","requires_named_unlocks":true}'::jsonb, 2),
    ('evidence_strength', 'Evidence strength', 'positive', 15::numeric,
     'Authority, directness, recency, and transportability of supporting evidence.',
     '{"scale":"claim_class","classes":["A","B","C","D","E"]}'::jsonb, 3),
    ('mission_relevance', 'Mission relevance', 'positive', 10::numeric,
     'Documented institutional relevance used for explanation and ordering only.',
     '{"scale":"ordinal","probability_weight":false}'::jsonb, 4),
    ('feasibility', 'Feasibility', 'positive', 15::numeric,
     'Eligibility, access, cost, schedule fit, geography, and attainability.',
     '{"scale":"verified_criteria_ratio","show_denominator":true}'::jsonb, 5),
    ('time_utility', 'Time utility', 'positive', 15::numeric,
     'Deadline urgency, lead time, time remaining, and route-closing risk.',
     '{"scale":"deadline_banded"}'::jsonb, 6),
    ('uncertainty', 'Uncertainty penalty', 'penalty', 20::numeric,
     'Penalty for missing data, indirect evidence, historical transportability, or hypothetical edges.',
     '{"scale":"ordinal","levels":5}'::jsonb, 7)
) as x(component_key, label, direction, max_points, description, scoring_rule, sort_order)
where v.rubric_key = 'action_impact';

insert into public.rubric_components (
  rubric_version_id, component_key, label, direction, max_points,
  description, scoring_rule, sort_order
)
select v.id, x.component_key, x.label, 'positive', x.max_points,
       x.description, '{"scale":"documented_readiness_band"}'::jsonb, x.sort_order
from public.rubric_versions v
cross join lateral (
  values
    ('academic', 'Academic preparation', 25::numeric, 'Prerequisite and academic-state readiness.', 1),
    ('clinical', 'Clinical exposure', 15::numeric, 'Completed clinical exposure and quality dimensions.', 2),
    ('research', 'Research development', 15::numeric, 'Completed research, depth, mentorship, and outputs.', 3),
    ('service', 'Service and community engagement', 15::numeric, 'Completed, sustained service and responsibility.', 4),
    ('exploration', 'Career exploration', 10::numeric, 'Documented exposure supporting an informed path choice.', 5),
    ('mentorship', 'Mentorship and relationships', 10::numeric, 'Sustained advising and mentorship connections.', 6),
    ('planning', 'Requirements and timing', 10::numeric, 'Eligibility, deadlines, application mechanics, and timeline.', 7)
) as x(component_key, label, max_points, description, sort_order)
where v.rubric_key = 'trajectory_readiness';

insert into public.decision_rules (
  rule_key, rule_type, definition, rationale, evidence_boundary
) values
  (
    'anticipated_is_not_completed', 'guardrail',
    '{"anticipated_credit":0,"display_separately":true}',
    'Planned activity cannot be treated as completed experience.',
    'No admissions effect is inferred.'
  ),
  (
    'no_gap_no_unlock_redundancy', 'redundancy',
    '{"reduce_rank_when":{"addresses_open_gap":false,"new_unlock_count":0}}',
    'An action that closes no documented gap and unlocks nothing has lower marginal value.',
    'This is a conservative product rule, not a universal diminishing-return curve.'
  ),
  (
    'generic_quantity_redundancy', 'redundancy',
    '{"reduce_rank_when":{"adds_only_quantity":true,"adds_quality":false,"new_unlock_count":0}}',
    'More generic hours should not outrank an action that adds a missing dimension or downstream option.',
    'No universal hours threshold or saturation function is claimed.'
  ),
  (
    'preserve_downstream_alternatives', 'alternative',
    '{"rank_by":["eligibility","accessibility","downstream_preservation","timing","evidence_confidence"],"exclude_blocked":true}',
    'When a route is blocked, alternatives should preserve the greatest feasible downstream value.',
    'Alternative ranking is a transparent heuristic, not a causal admissions estimate.'
  );

alter table public.nodes enable row level security;
alter table public.edges enable row level security;
alter table public.evidence_sources enable row level security;
alter table public.evidence_records enable row level security;
alter table public.edge_evidence enable row level security;
alter table public.rubric_versions enable row level security;
alter table public.rubric_components enable row level security;
alter table public.decision_rules enable row level security;
alter table public.student_profiles enable row level security;
alter table public.student_node_states enable row level security;

grant select on public.nodes, public.edges, public.evidence_sources,
  public.evidence_records, public.edge_evidence, public.rubric_versions,
  public.rubric_components, public.decision_rules to anon, authenticated;

grant select, insert, update, delete
  on public.student_profiles, public.student_node_states to authenticated;

create policy "Public read access on nodes"
  on public.nodes for select to anon, authenticated using (true);
create policy "Public read access on edges"
  on public.edges for select to anon, authenticated using (true);
create policy "Public read access on evidence sources"
  on public.evidence_sources for select to anon, authenticated using (true);
create policy "Public read access on evidence records"
  on public.evidence_records for select to anon, authenticated using (true);
create policy "Public read access on edge evidence"
  on public.edge_evidence for select to anon, authenticated using (true);
create policy "Public read access on rubric versions"
  on public.rubric_versions for select to anon, authenticated using (true);
create policy "Public read access on rubric components"
  on public.rubric_components for select to anon, authenticated using (true);
create policy "Public read access on decision rules"
  on public.decision_rules for select to anon, authenticated using (true);

create policy "Users read their own profile"
  on public.student_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own profile"
  on public.student_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their own profile"
  on public.student_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete their own profile"
  on public.student_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read their own node states"
  on public.student_node_states for select to authenticated
  using (exists (
    select 1 from public.student_profiles p
    where p.id = profile_id and p.user_id = (select auth.uid())
  ));
create policy "Users create their own node states"
  on public.student_node_states for insert to authenticated
  with check (exists (
    select 1 from public.student_profiles p
    where p.id = profile_id and p.user_id = (select auth.uid())
  ));
create policy "Users update their own node states"
  on public.student_node_states for update to authenticated
  using (exists (
    select 1 from public.student_profiles p
    where p.id = profile_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.student_profiles p
    where p.id = profile_id and p.user_id = (select auth.uid())
  ));
create policy "Users delete their own node states"
  on public.student_node_states for delete to authenticated
  using (exists (
    select 1 from public.student_profiles p
    where p.id = profile_id and p.user_id = (select auth.uid())
  ));


