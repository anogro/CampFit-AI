-- CampFit v3 demo-only catalog.
-- This table is intentionally separate from public.programs so the demo can be
-- removed with DROP TABLE or by demo_batch without touching production data.
create table if not exists public.campfit_demo_programs (
  like public.programs including all
);

alter table public.campfit_demo_programs
  add column if not exists demo_batch text not null default 'campfit-v3-demo-3';

alter table public.campfit_demo_programs
  add column if not exists demo_source text not null default 'campfit_v3';

create unique index if not exists campfit_demo_programs_slug_key
  on public.campfit_demo_programs (slug);

create index if not exists campfit_demo_programs_batch_idx
  on public.campfit_demo_programs (demo_batch);

alter table public.campfit_demo_programs enable row level security;

drop policy if exists campfit_demo_programs_service_role_all
  on public.campfit_demo_programs;

create policy campfit_demo_programs_service_role_all
  on public.campfit_demo_programs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
