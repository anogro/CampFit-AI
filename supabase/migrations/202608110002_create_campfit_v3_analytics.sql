create table if not exists public.campfit_v3_analytics_sessions (
  journey_id uuid primary key,
  visit_id uuid,
  handoff_id uuid,
  mode text not null check (mode in ('production', 'demo')),
  status text not null default 'started' check (status in (
    'started',
    'in_progress',
    'recommendation_ready',
    'completed',
    'abandoned',
    'restarted'
  )),
  source_app text not null default 'campfit',
  landing_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  started_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  last_stage text,
  last_question_key text,
  last_question_index integer check (last_question_index is null or last_question_index >= 0),
  progress numeric(5, 2) check (progress is null or (progress >= 0 and progress <= 100)),
  result_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campfit_v3_analytics_events (
  event_id uuid primary key,
  visit_id uuid,
  journey_id uuid,
  handoff_id uuid,
  event_name text not null check (event_name in (
    'campfit_opened',
    'campfit_started',
    'campfit_intake_submitted',
    'campfit_conversation_started',
    'campfit_question_answered',
    'campfit_recommendation_requested',
    'campfit_recommendation_completed',
    'campfit_result_viewed',
    'campfit_city_clicked',
    'campfit_program_clicked',
    'campfit_report_action',
    'campfit_back_to_chat',
    'campfit_restart',
    'campfit_heartbeat'
  )),
  mode text not null check (mode in ('production', 'demo')),
  source_app text not null default 'campfit',
  stage text,
  question_key text,
  question_index integer check (question_index is null or question_index >= 0),
  progress numeric(5, 2) check (progress is null or (progress >= 0 and progress <= 100)),
  result_id uuid,
  item_type text check (item_type is null or item_type in ('city', 'program')),
  item_id text,
  item_name_snapshot text,
  city_id text,
  city_name_snapshot text,
  country_name_snapshot text,
  item_rank integer check (item_rank is null or item_rank >= 1),
  link_target text,
  action text,
  answer_kind text,
  catalog_source text check (catalog_source is null or catalog_source in ('supabase', 'demo', 'unavailable')),
  limited_result boolean,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  received_at timestamptz not null default timezone('utc', now()),
  constraint campfit_v3_analytics_events_has_visit_or_journey check (visit_id is not null or journey_id is not null)
);

create table if not exists public.campfit_v3_analytics_recommendations (
  result_id uuid not null,
  journey_id uuid not null,
  mode text not null check (mode in ('production', 'demo')),
  item_type text not null check (item_type in ('city', 'program')),
  item_id text not null,
  item_name_snapshot text not null,
  city_id text,
  city_name_snapshot text,
  country_name_snapshot text,
  item_rank integer not null check (item_rank >= 1),
  catalog_source text not null check (catalog_source in ('supabase', 'demo', 'unavailable')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (result_id, item_type, item_id)
);

create index if not exists campfit_v3_analytics_sessions_status_started_idx
  on public.campfit_v3_analytics_sessions (status, started_at desc);
create index if not exists campfit_v3_analytics_sessions_mode_started_idx
  on public.campfit_v3_analytics_sessions (mode, started_at desc);
create index if not exists campfit_v3_analytics_events_journey_received_idx
  on public.campfit_v3_analytics_events (journey_id, received_at desc);
create index if not exists campfit_v3_analytics_events_name_received_idx
  on public.campfit_v3_analytics_events (event_name, received_at desc);
create index if not exists campfit_v3_analytics_recommendations_item_idx
  on public.campfit_v3_analytics_recommendations (item_type, item_id, mode);

alter table public.campfit_v3_analytics_sessions enable row level security;
alter table public.campfit_v3_analytics_events enable row level security;
alter table public.campfit_v3_analytics_recommendations enable row level security;

drop policy if exists campfit_v3_analytics_sessions_service_role_all
  on public.campfit_v3_analytics_sessions;
create policy campfit_v3_analytics_sessions_service_role_all
  on public.campfit_v3_analytics_sessions
  for all to service_role
  using (true)
  with check (true);

drop policy if exists campfit_v3_analytics_events_service_role_all
  on public.campfit_v3_analytics_events;
create policy campfit_v3_analytics_events_service_role_all
  on public.campfit_v3_analytics_events
  for all to service_role
  using (true)
  with check (true);

drop policy if exists campfit_v3_analytics_recommendations_service_role_all
  on public.campfit_v3_analytics_recommendations;
create policy campfit_v3_analytics_recommendations_service_role_all
  on public.campfit_v3_analytics_recommendations
  for all to service_role
  using (true)
  with check (true);
