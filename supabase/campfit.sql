create table if not exists public.campfit_sessions (
  id bigint generated always as identity primary key,
  session_id text not null unique,
  parent_input jsonb not null,
  structured_profile jsonb not null,
  camp_readiness_check jsonb not null,
  follow_up_answers jsonb not null default '[]'::jsonb,
  recommended_camps jsonb not null default '[]'::jsonb,
  consultation_requested boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.campfit_feedback (
  id bigint generated always as identity primary key,
  session_id text not null,
  feedback text not null check (
    feedback in ('good_fit', 'different', 'unsure', 'consultation_requested')
  ),
  clicked_camp text,
  created_at timestamptz not null default now()
);

create index if not exists campfit_feedback_session_id_idx
  on public.campfit_feedback (session_id);

alter table public.campfit_sessions enable row level security;
alter table public.campfit_feedback enable row level security;

create policy "campfit_sessions_service_role_all"
  on public.campfit_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "campfit_feedback_service_role_all"
  on public.campfit_feedback
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
