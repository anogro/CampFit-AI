-- CampFit English requirement projection
--
-- This migration was prepared after inspecting the live Supabase schema and
-- is intended to be applied once to the production project.
--
-- Source of truth:
--   * Official values remain in program_provider_claims and
--     program_evidence_sources, linked through program_fact_observations.
--   * These nullable columns are a recommendation-read projection only.
--   * NULL means that the projection has not been established; the catalog
--     layer must expose it as unknown.
--
-- english_exposure is deliberately not changed or reused as a requirement
-- level. Exposure and participant requirement are separate dimensions.

alter table public.campfit_program_profiles
  add column official_english_requirement_level text,
  add column official_english_requirement_text text,
  add column official_english_qualification jsonb,
  add column official_instruction_language_mode text,
  add column official_beginner_participation boolean,
  add column inferred_english_requirement_level text,
  add column inferred_english_requirement_confidence numeric(4, 3),
  add column inferred_english_requirement_version text;

alter table public.campfit_program_profiles
  add constraint campfit_program_profiles_official_english_requirement_level_check
  check (
    official_english_requirement_level is null
    or official_english_requirement_level in (
      'no_requirement',
      'beginner_friendly',
      'general_english',
      'academic_english',
      'unknown'
    )
  ),
  add constraint campfit_program_profiles_inferred_english_requirement_level_check
  check (
    inferred_english_requirement_level is null
    or inferred_english_requirement_level in (
      'no_requirement',
      'beginner_friendly',
      'general_english',
      'academic_english',
      'unknown'
    )
  ),
  add constraint campfit_program_profiles_official_instruction_language_mode_check
  check (
    official_instruction_language_mode is null
    or official_instruction_language_mode in (
      'english_only',
      'english_led',
      'bilingual',
      'activity_with_english',
      'other',
      'unknown'
    )
  ),
  add constraint campfit_program_profiles_inferred_english_requirement_confidence_check
  check (
    inferred_english_requirement_confidence is null
    or inferred_english_requirement_confidence between 0 and 1
  );

comment on column public.campfit_program_profiles.official_english_requirement_level is
  'Verified provider or official-source requirement level. This is not populated from program type alone.';
comment on column public.campfit_program_profiles.official_english_requirement_text is
  'Verbatim official requirement text. Keep the original wording instead of replacing it with a label.';
comment on column public.campfit_program_profiles.official_english_qualification is
  'Structured official qualification, for example {"type":"IELTS","minimum":5.5,"unit":"overall"}.';
comment on column public.campfit_program_profiles.official_instruction_language_mode is
  'Verified instruction-language mode; this is separate from English exposure and participant requirement.';
comment on column public.campfit_program_profiles.official_beginner_participation is
  'Verified whether beginners may participate. NULL means the source does not state this.';
comment on column public.campfit_program_profiles.inferred_english_requirement_level is
  'CampFit inference from reviewed program evidence. Never present this as an official requirement.';
comment on column public.campfit_program_profiles.inferred_english_requirement_confidence is
  'Confidence for the inferred requirement level, from 0 to 1.';
comment on column public.campfit_program_profiles.inferred_english_requirement_version is
  'Version of the deterministic/LLM inference contract used to produce the inferred value.';

-- Reuse the existing evidence model for English requirement observations.
-- Fact-key conventions should be documented in the ingestion layer:
-- requirement_level, requirement_text, qualification,
-- instruction_language_mode, beginner_participation.
alter table public.program_fact_observations
  drop constraint if exists program_fact_observations_dimension_key_check;

alter table public.program_fact_observations
  add constraint program_fact_observations_dimension_key_check
  check (
    dimension_key in (
      'care_emotional_support',
      'staff_management',
      'safety_emergency',
      'parent_communication',
      'english_environment',
      'english_requirement',
      'beginner_support',
      'teaching_quality',
      'living_support',
      'cost_transparency',
      'advertising_consistency'
    )
  );

create index if not exists campfit_program_profiles_english_requirement_idx
  on public.campfit_program_profiles (
    official_english_requirement_level,
    inferred_english_requirement_level
  );
