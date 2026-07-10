-- Phase 1A: evidence-based program quality data foundation. This migration does
-- not backfill existing records or affect matching, ranking, or report UI.
create extension if not exists pgcrypto;

create table if not exists public.program_quality_scoring_versions (
  id uuid primary key default gen_random_uuid(),
  version_key text not null unique,
  description text,
  status text not null check (status in ('draft', 'shadow', 'active', 'retired')),
  prior_score numeric(5, 2) not null default 60 check (prior_score between 0 and 100),
  confidence_weights jsonb not null,
  dimension_weights jsonb not null,
  public_visibility_rules jsonb not null,
  rule_config jsonb not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz
);

create table if not exists public.program_provider_claims (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  provider_partner_id uuid references public.partners(id) on delete set null,
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  claim_key text not null,
  claim_value jsonb not null,
  unit text,
  claim_status text not null default 'submitted' check (claim_status in ('submitted', 'under_review', 'verified', 'rejected', 'expired')),
  valid_from timestamptz,
  valid_until timestamptz,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  source_type text not null check (source_type in ('provider_claim', 'provider_official_document', 'partner_verified_document', 'public_official_page', 'independent_review', 'verified_parent_review', 'campfit_post_program_survey', 'consultation_feedback', 'official_incident_record', 'manual_audit', 'legacy_program_verification')),
  source_url text,
  storage_path text,
  title text,
  source_date timestamptz,
  collected_at timestamptz not null default now(),
  valid_until timestamptz,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected', 'expired')),
  verified_participation boolean not null default false,
  is_independent boolean not null default false,
  canonical_url text,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_fact_observations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  evidence_source_id uuid not null references public.program_evidence_sources(id) on delete cascade,
  provider_claim_id uuid references public.program_provider_claims(id) on delete set null,
  dimension_key text not null check (dimension_key in ('care_emotional_support', 'staff_management', 'safety_emergency', 'parent_communication', 'english_environment', 'beginner_support', 'teaching_quality', 'living_support', 'cost_transparency', 'advertising_consistency')),
  fact_key text not null,
  fact_value jsonb not null,
  normalized_numeric_value numeric(5, 2) check (normalized_numeric_value between 0 and 100),
  unit text,
  observation_status text not null default 'extracted' check (observation_status in ('extracted', 'verified', 'disputed', 'rejected', 'expired')),
  observation_confidence numeric(4, 3) not null check (observation_confidence between 0 and 1),
  observed_at timestamptz,
  valid_until timestamptz,
  extraction_method text not null check (extraction_method in ('manual', 'deterministic', 'ai_extracted', 'imported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_quality_scores (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  scoring_version_id uuid not null references public.program_quality_scoring_versions(id),
  calculation_status text not null default 'shadow' check (calculation_status in ('shadow', 'published', 'superseded', 'failed')),
  overall_quality_score numeric(5, 2) check (overall_quality_score between 0 and 100),
  evidence_confidence numeric(5, 2) not null check (evidence_confidence between 0 and 100),
  confidence_label text not null check (confidence_label in ('very_low', 'low', 'medium', 'high', 'very_high')),
  dimension_coverage_count integer not null check (dimension_coverage_count between 0 and 10),
  independent_source_count integer not null check (independent_source_count >= 0),
  critical_risk_count integer not null default 0 check (critical_risk_count >= 0),
  public_eligible boolean not null default false,
  public_status_label text check (public_status_label in ('운영 정보 확인 중', '근거 보통 · 참고용', '근거 충분', '추천 보류 · 추가 확인 필요')),
  data_gaps jsonb not null default '[]'::jsonb,
  calculation_summary jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.program_quality_dimension_scores (
  id uuid primary key default gen_random_uuid(),
  program_quality_score_id uuid not null references public.program_quality_scores(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  dimension_key text not null check (dimension_key in ('care_emotional_support', 'staff_management', 'safety_emergency', 'parent_communication', 'english_environment', 'beginner_support', 'teaching_quality', 'living_support', 'cost_transparency', 'advertising_consistency')),
  prior_score numeric(5, 2) not null check (prior_score between 0 and 100),
  observed_score numeric(5, 2) check (observed_score between 0 and 100),
  adjusted_score numeric(5, 2) check (adjusted_score between 0 and 100),
  dimension_confidence numeric(5, 2) not null check (dimension_confidence between 0 and 100),
  evidence_count integer not null check (evidence_count >= 0),
  independent_source_count integer not null check (independent_source_count >= 0),
  data_gaps jsonb not null default '[]'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (program_quality_score_id, dimension_key)
);

create table if not exists public.program_critical_risk_flags (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  evidence_source_id uuid references public.program_evidence_sources(id) on delete set null,
  risk_key text,
  severity text not null check (severity in ('medium', 'high', 'critical')),
  status text not null default 'under_review' check (status in ('under_review', 'confirmed', 'resolved', 'dismissed')),
  internal_summary text not null,
  public_summary text,
  detected_at timestamptz not null default now(),
  confirmed_at timestamptz,
  resolved_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists program_provider_claims_program_id_idx on public.program_provider_claims(program_id);
create index if not exists program_provider_claims_partner_status_idx on public.program_provider_claims(provider_partner_id, claim_status);
create index if not exists program_evidence_sources_program_id_idx on public.program_evidence_sources(program_id);
create index if not exists program_evidence_sources_source_type_idx on public.program_evidence_sources(source_type);
create index if not exists program_evidence_sources_verification_status_idx on public.program_evidence_sources(verification_status);
create unique index if not exists program_evidence_sources_content_hash_uniq on public.program_evidence_sources(program_id, source_type, content_hash) where content_hash is not null;
create unique index if not exists program_evidence_sources_canonical_url_uniq on public.program_evidence_sources(program_id, canonical_url) where canonical_url is not null;
create index if not exists program_fact_observations_program_dimension_idx on public.program_fact_observations(program_id, dimension_key);
create index if not exists program_quality_scores_program_version_calculated_idx on public.program_quality_scores(program_id, scoring_version_id, calculated_at desc);
create index if not exists program_quality_dimension_scores_program_dimension_idx on public.program_quality_dimension_scores(program_id, dimension_key);
create index if not exists program_critical_risk_flags_program_status_severity_idx on public.program_critical_risk_flags(program_id, status, severity);

alter table public.program_quality_scoring_versions enable row level security;
alter table public.program_provider_claims enable row level security;
alter table public.program_evidence_sources enable row level security;
alter table public.program_fact_observations enable row level security;
alter table public.program_quality_scores enable row level security;
alter table public.program_quality_dimension_scores enable row level security;
alter table public.program_critical_risk_flags enable row level security;

do $$
declare target_table text;
begin
  foreach target_table in array array[
    'program_quality_scoring_versions', 'program_provider_claims', 'program_evidence_sources',
    'program_fact_observations', 'program_quality_scores', 'program_quality_dimension_scores',
    'program_critical_risk_flags'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = target_table and policyname = target_table || '_service_role_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        target_table || '_service_role_all', target_table
      );
    end if;
  end loop;
end $$;

do $$
declare target_table text;
begin
  foreach target_table in array array[
    'program_provider_claims', 'program_evidence_sources', 'program_fact_observations', 'program_critical_risk_flags'
  ] loop
    if not exists (
      select 1 from pg_trigger
      where tgrelid = format('public.%I', target_table)::regclass and tgname = target_table || '_set_updated_at'
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_campfit_v2_updated_at()',
        target_table || '_set_updated_at', target_table
      );
    end if;
  end loop;
end $$;

insert into public.program_quality_scoring_versions (
  version_key, description, status, prior_score, confidence_weights, dimension_weights,
  public_visibility_rules, rule_config, activated_at
) values (
  'campfit_quality_v1_shadow',
  'Phase 1A evidence-based program quality scoring in shadow mode.',
  'shadow',
  60,
  '{"evidenceVolume":0.2,"sourceDiversity":0.2,"sourceAuthority":0.2,"recency":0.15,"dimensionCoverage":0.15,"agreement":0.1}'::jsonb,
  '{"care_emotional_support":0.12,"staff_management":0.1,"safety_emergency":0.14,"parent_communication":0.09,"english_environment":0.1,"beginner_support":0.09,"teaching_quality":0.1,"living_support":0.1,"cost_transparency":0.08,"advertising_consistency":0.08}'::jsonb,
  '{"confidenceThreshold":50,"minimumDimensionCoverage":6,"minimumIndependentSourceCount":1}'::jsonb,
  '{"providerOnlyConfidenceCap":30,"providerOnlyPositivePriorAdjustmentCap":5,"evidenceVolumeSaturationCount":6,"recencyHalfLifeDays":365,"sourceAuthorityWeights":{"provider_claim":0.2,"provider_official_document":0.45,"partner_verified_document":0.7,"public_official_page":0.55,"independent_review":0.5,"verified_parent_review":0.8,"campfit_post_program_survey":0.9,"consultation_feedback":0.65,"official_incident_record":1,"manual_audit":0.95,"legacy_program_verification":0.7}}'::jsonb,
  now()
) on conflict (version_key) do nothing;
