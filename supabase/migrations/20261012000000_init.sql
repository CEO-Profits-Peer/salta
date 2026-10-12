-- AI Evolution Studios: initial schema, RLS and storage policies.
-- Run once (Supabase SQL Editor, or `supabase db push`).

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── profiles ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Researcher' check (char_length(display_name) between 1 and 60),
  avatar jsonb not null default '{}'::jsonb check (pg_column_size(avatar) < 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Researcher'), 60))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────── chambers ─────────────
create table public.chambers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  chamber_type text not null check (chamber_type in ('tester', 'builder', 'instructor')),
  description text not null default '' check (char_length(description) <= 2000),
  configuration jsonb not null default '{}'::jsonb check (pg_column_size(configuration) < 65536),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chambers_owner_idx on public.chambers (owner_id);
create trigger chambers_updated before update on public.chambers for each row execute function public.set_updated_at();

-- ───────────── agents ─────────────
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  chamber_id uuid references public.chambers(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  algorithm_type text not null check (char_length(algorithm_type) <= 60),
  configuration jsonb not null default '{}'::jsonb check (pg_column_size(configuration) < 65536),
  generation integer not null default 0 check (generation >= 0),
  parent_agent_id uuid references public.agents(id) on delete set null,
  lineage jsonb not null default '{}'::jsonb check (pg_column_size(lineage) < 16384),
  status text not null default 'idle' check (status in ('idle', 'training', 'evaluated', 'retired')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agents_owner_idx on public.agents (owner_id);
create index agents_public_idx on public.agents (visibility) where visibility = 'public';
create trigger agents_updated before update on public.agents for each row execute function public.set_updated_at();

-- ───────────── experiments ─────────────
create table public.experiments (
  id uuid primary key default gen_random_uuid(),            -- the browser supplies its own UUID, so syncing is idempotent
  owner_id uuid not null references auth.users(id) on delete cascade,
  chamber_id uuid references public.chambers(id) on delete set null,
  experiment_type text not null check (char_length(experiment_type) <= 60),
  configuration jsonb not null default '{}'::jsonb check (pg_column_size(configuration) < 65536),
  execution_backend text not null default 'browser_worker' check (execution_backend in ('browser_worker', 'wasm', 'webgpu', 'remote')),
  status text not null default 'draft' check (status in ('draft', 'queued', 'running', 'pausing', 'paused', 'stopping', 'completed', 'failed', 'cancelled')),
  current_generation integer not null default 0 check (current_generation >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index experiments_owner_idx on public.experiments (owner_id, created_at desc);
create trigger experiments_updated before update on public.experiments for each row execute function public.set_updated_at();

create table public.experiment_metrics (
  id bigint generated always as identity primary key,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  generation integer not null check (generation >= 0),
  metric_name text not null check (char_length(metric_name) <= 60),
  metric_value double precision not null,
  recorded_at timestamptz not null default now(),
  unique (experiment_id, generation, metric_name)
);

-- ───────────── artifacts (metadata only; files live in Storage) ─────────────
create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid references public.experiments(id) on delete cascade,
  artifact_type text not null check (char_length(artifact_type) <= 40),
  storage_path text not null unique check (char_length(storage_path) <= 300),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) < 16384),
  schema_version integer not null default 1,
  created_at timestamptz not null default now()
);
create index artifacts_owner_idx on public.artifacts (owner_id);

-- ───────────── game versions & evaluations ─────────────
create table public.game_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,   -- null = system-owned
  parent_version_id uuid references public.game_versions(id) on delete set null,
  experiment_id uuid references public.experiments(id) on delete set null,
  configuration jsonb not null check (pg_column_size(configuration) < 65536),
  evaluation_summary jsonb not null default '{}'::jsonb check (pg_column_size(evaluation_summary) < 16384),
  status text not null default 'candidate' check (status in ('candidate', 'rejected', 'verified', 'archived')),
  created_at timestamptz not null default now()
);
create index game_versions_owner_idx on public.game_versions (owner_id);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  game_version_id uuid not null references public.game_versions(id) on delete cascade,
  evaluation_suite text not null check (char_length(evaluation_suite) <= 80),
  seed bigint,
  results jsonb not null default '{}'::jsonb check (pg_column_size(results) < 65536),
  validation_status text not null default 'self_reported' check (validation_status in ('self_reported', 'locally_evaluated', 'verified')),
  created_at timestamptz not null default now()
);
create index evaluations_version_idx on public.evaluations (game_version_id);

-- ───────────── challenges ─────────────
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete cascade,  -- null = system challenge
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 4000),
  rules jsonb not null default '{}'::jsonb check (pg_column_size(rules) < 32768),
  evaluation_configuration jsonb not null default '{}'::jsonb check (pg_column_size(evaluation_configuration) < 32768),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now()
);

create table public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  submitted_artifact_id uuid references public.artifacts(id) on delete set null,
  evaluation_status text not null default 'pending' check (evaluation_status in ('pending', 'verified', 'rejected')),
  score double precision,
  created_at timestamptz not null default now()
);
create index submissions_challenge_idx on public.challenge_submissions (challenge_id, score desc);
create index submissions_user_idx on public.challenge_submissions (user_id);

-- ───────────── Row Level Security ─────────────
alter table public.profiles enable row level security;
alter table public.chambers enable row level security;
alter table public.agents enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_metrics enable row level security;
alter table public.artifacts enable row level security;
alter table public.game_versions enable row level security;
alter table public.evaluations enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_submissions enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy chambers_select on public.chambers for select to authenticated using (owner_id = auth.uid() or visibility = 'public');
create policy chambers_insert on public.chambers for insert to authenticated with check (owner_id = auth.uid());
create policy chambers_update on public.chambers for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy chambers_delete on public.chambers for delete to authenticated using (owner_id = auth.uid());

create policy agents_select on public.agents for select to authenticated using (owner_id = auth.uid() or visibility = 'public');
create policy agents_insert on public.agents for insert to authenticated with check (owner_id = auth.uid());
create policy agents_update on public.agents for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy agents_delete on public.agents for delete to authenticated using (owner_id = auth.uid());

create policy experiments_select on public.experiments for select to authenticated using (owner_id = auth.uid());
create policy experiments_insert on public.experiments for insert to authenticated with check (owner_id = auth.uid());
create policy experiments_update on public.experiments for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy experiments_delete on public.experiments for delete to authenticated using (owner_id = auth.uid());

create policy metrics_select on public.experiment_metrics for select to authenticated using (exists (select 1 from public.experiments e where e.id = experiment_id and e.owner_id = auth.uid()));
create policy metrics_insert on public.experiment_metrics for insert to authenticated with check (exists (select 1 from public.experiments e where e.id = experiment_id and e.owner_id = auth.uid()));
create policy metrics_update on public.experiment_metrics for update to authenticated using (exists (select 1 from public.experiments e where e.id = experiment_id and e.owner_id = auth.uid())) with check (exists (select 1 from public.experiments e where e.id = experiment_id and e.owner_id = auth.uid()));
create policy metrics_delete on public.experiment_metrics for delete to authenticated using (exists (select 1 from public.experiments e where e.id = experiment_id and e.owner_id = auth.uid()));

create policy artifacts_select on public.artifacts for select to authenticated using (owner_id = auth.uid());
create policy artifacts_insert on public.artifacts for insert to authenticated with check (owner_id = auth.uid());
create policy artifacts_update on public.artifacts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy artifacts_delete on public.artifacts for delete to authenticated using (owner_id = auth.uid());

-- Users can never mark a game version 'verified'; only the service role (a future server-side evaluator) can.
create policy gv_select on public.game_versions for select to authenticated using (owner_id = auth.uid() or owner_id is null);
create policy gv_insert on public.game_versions for insert to authenticated with check (owner_id = auth.uid() and status in ('candidate', 'rejected'));
create policy gv_update on public.game_versions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and status in ('candidate', 'rejected', 'archived'));
create policy gv_delete on public.game_versions for delete to authenticated using (owner_id = auth.uid());

-- Users can only submit self-reported or locally evaluated results; 'verified' is reserved for the service role.
create policy eval_select on public.evaluations for select to authenticated using (exists (select 1 from public.game_versions g where g.id = game_version_id and (g.owner_id = auth.uid() or g.owner_id is null)));
create policy eval_insert on public.evaluations for insert to authenticated with check (validation_status in ('self_reported', 'locally_evaluated') and exists (select 1 from public.game_versions g where g.id = game_version_id and g.owner_id = auth.uid()));
create policy eval_delete on public.evaluations for delete to authenticated using (exists (select 1 from public.game_versions g where g.id = game_version_id and g.owner_id = auth.uid()));

create policy challenges_select on public.challenges for select to anon, authenticated using (visibility = 'public' or creator_id = auth.uid());
create policy challenges_insert on public.challenges for insert to authenticated with check (creator_id = auth.uid());
create policy challenges_update on public.challenges for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy challenges_delete on public.challenges for delete to authenticated using (creator_id = auth.uid());

-- Submissions start 'pending' with no score; score and 'verified' can only be written by the service role.
create policy subs_select on public.challenge_submissions for select to authenticated using (user_id = auth.uid() or evaluation_status = 'verified');
create policy subs_insert on public.challenge_submissions for insert to authenticated with check (user_id = auth.uid() and evaluation_status = 'pending' and score is null);
create policy subs_delete on public.challenge_submissions for delete to authenticated using (user_id = auth.uid() and evaluation_status = 'pending');

-- ───────────── Storage: private bucket, files under <user-id>/... ─────────────
insert into storage.buckets (id, name, public, file_size_limit) values ('artifacts', 'artifacts', false, 5242880) on conflict (id) do nothing;
create policy artifacts_obj_select on storage.objects for select to authenticated using (bucket_id = 'artifacts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy artifacts_obj_insert on storage.objects for insert to authenticated with check (bucket_id = 'artifacts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy artifacts_obj_update on storage.objects for update to authenticated using (bucket_id = 'artifacts' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'artifacts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy artifacts_obj_delete on storage.objects for delete to authenticated using (bucket_id = 'artifacts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────── System challenge ─────────────
insert into public.challenges (creator_id, name, description, rules, evaluation_configuration, visibility)
select null, 'Maze Gauntlet v1', 'Improve a deterministic maze under fixed hard constraints. Scored on held-out seeds.',
  '{"actions":["up","down","left","right"],"version":"1"}'::jsonb, '{"train_seeds":5,"heldout_seeds":5}'::jsonb, 'public'
where not exists (select 1 from public.challenges where creator_id is null and name = 'Maze Gauntlet v1');
