create extension if not exists pgcrypto;

create or replace function public.set_campfit_v2_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.campfit_v2_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  anonymous_session_id text null,
  status text not null default 'draft' check (
    status in ('draft', 'intake_completed', 'analyzed', 'followup_completed', 'recommended', 'abandoned')
  ),
  current_step text not null default 'required_intake',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campfit_v2_required_intakes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.campfit_v2_sessions(id) on delete cascade unique,
  child_age_at_start integer not null check (child_age_at_start between 3 and 18),
  departure_window text null check (
    departure_window is null
    or departure_window in ('winter_break', 'summer_break', 'within_3_months', 'within_6_months', 'within_1_year', 'undecided')
  ),
  duration_weeks_min integer null check (duration_weeks_min is null or duration_weeks_min >= 0),
  duration_weeks_max integer null check (duration_weeks_max is null or duration_weeks_max >= 0),
  total_budget_all_in_krw_min integer null check (total_budget_all_in_krw_min is null or total_budget_all_in_krw_min >= 0),
  total_budget_all_in_krw_max integer null check (total_budget_all_in_krw_max is null or total_budget_all_in_krw_max >= 0),
  budget_scope text not null default 'family_total' check (
    budget_scope in ('child_only', 'child_plus_one_parent', 'family_total', 'unknown')
  ),
  child_count integer not null default 1 check (child_count >= 1),
  parent_count integer not null default 0 check (parent_count >= 0),
  sibling_count integer not null default 0 check (sibling_count >= 0),
  preferred_region_groups text[] not null default '{}'::text[] check (
    preferred_region_groups <@ array[
      'southeast_asia',
      'oceania',
      'north_america',
      'europe',
      'domestic',
      'no_preference',
      'undecided'
    ]::text[]
  ),
  region_priority text not null default 'flexible' check (region_priority in ('hard', 'strong', 'flexible', 'low')),
  parent_accompaniment_mode text not null default 'undecided' check (
    parent_accompaniment_mode in (
      'parent_required',
      'parent_can_stay',
      'departure_arrival_only',
      'child_solo_or_chaperone_ok',
      'undecided'
    )
  ),
  korean_support_need text not null default 'undecided' check (
    korean_support_need in (
      'resident_korean_manager',
      'daily_korean_communication',
      'emergency_only',
      'not_needed',
      'undecided'
    )
  ),
  accommodation_preferences text[] not null default '{}'::text[] check (
    accommodation_preferences <@ array['parent_stay', 'homestay', 'dormitory', 'hotel_resort', 'day_only', 'undecided']::text[]
  ),
  raw_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    duration_weeks_min is null
    or duration_weeks_max is null
    or duration_weeks_min <= duration_weeks_max
  ),
  check (
    total_budget_all_in_krw_min is null
    or total_budget_all_in_krw_max is null
    or total_budget_all_in_krw_min <= total_budget_all_in_krw_max
  )
);

create table if not exists public.campfit_v2_natural_inputs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.campfit_v2_sessions(id) on delete cascade unique,
  situation_text text not null,
  child_context_text text null,
  success_and_concerns_text text null,
  additional_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campfit_v2_ai_extractions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.campfit_v2_sessions(id) on delete cascade,
  model_name text null,
  extraction_version text not null default 'v1',
  extracted_profile jsonb not null,
  missing_slots jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  confidence_map jsonb not null default '{}'::jsonb,
  recommended_question_keys text[] not null default '{}'::text[],
  raw_model_response jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.campfit_v2_question_bank (
  id uuid primary key default gen_random_uuid(),
  question_key text not null unique,
  phase text not null default 'dynamic_followup' check (
    phase in ('required_intake', 'dynamic_followup', 'conflict_resolution')
  ),
  slot_key text not null,
  priority integer not null default 100,
  question_type text not null check (question_type in ('single_choice', 'multi_choice', 'number', 'text')),
  title text not null,
  helper_text text null,
  placeholder text null,
  example_text text null,
  options jsonb not null default '[]'::jsonb,
  result_mapping jsonb not null default '{}'::jsonb,
  applies_when jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campfit_v2_dynamic_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.campfit_v2_sessions(id) on delete cascade,
  question_bank_id uuid null references public.campfit_v2_question_bank(id) on delete set null,
  question_key text not null,
  source text not null default 'ai' check (source in ('ai', 'rule', 'conflict')),
  priority integer not null default 100,
  reason text null,
  status text not null default 'pending' check (status in ('pending', 'answered', 'skipped')),
  question_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  answered_at timestamptz null
);

create table if not exists public.campfit_v2_dynamic_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.campfit_v2_sessions(id) on delete cascade,
  dynamic_question_id uuid not null references public.campfit_v2_dynamic_questions(id) on delete cascade,
  question_key text not null,
  answer jsonb not null,
  answer_text text null,
  created_at timestamptz not null default now()
);

create table if not exists public.campfit_v2_consulting_profiles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.campfit_v2_sessions(id) on delete cascade unique,
  profile_version text not null default 'v1',
  hard_constraints jsonb not null default '{}'::jsonb,
  strong_preferences jsonb not null default '{}'::jsonb,
  soft_preferences jsonb not null default '{}'::jsonb,
  child_readiness jsonb not null default '{}'::jsonb,
  parent_intent jsonb not null default '{}'::jsonb,
  risk_profile jsonb not null default '{}'::jsonb,
  flexibility jsonb not null default '{}'::jsonb,
  budget_estimates jsonb not null default '{}'::jsonb,
  recommendation_strategy text null,
  legacy_parent_input jsonb null,
  legacy_parent_analysis jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campfit_v2_recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.campfit_v2_sessions(id) on delete cascade,
  consulting_profile_id uuid not null references public.campfit_v2_consulting_profiles(id) on delete cascade,
  run_version text not null default 'v1',
  strategy_summary jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  excluded_candidates jsonb not null default '[]'::jsonb,
  relaxed_candidates jsonb not null default '[]'::jsonb,
  report jsonb not null default '{}'::jsonb,
  legacy_matching_payload jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.campfit_v2_travel_cost_assumptions (
  id uuid primary key default gen_random_uuid(),
  region_group text not null check (
    region_group in ('southeast_asia', 'oceania', 'north_america', 'europe', 'domestic', 'no_preference', 'undecided')
  ),
  country_code text null,
  country_name text null,
  season text not null default 'default',
  flight_per_person_krw_min integer null check (flight_per_person_krw_min is null or flight_per_person_krw_min >= 0),
  flight_per_person_krw_max integer null check (flight_per_person_krw_max is null or flight_per_person_krw_max >= 0),
  visa_insurance_krw_min integer null check (visa_insurance_krw_min is null or visa_insurance_krw_min >= 0),
  visa_insurance_krw_max integer null check (visa_insurance_krw_max is null or visa_insurance_krw_max >= 0),
  local_transport_krw_min integer null check (local_transport_krw_min is null or local_transport_krw_min >= 0),
  local_transport_krw_max integer null check (local_transport_krw_max is null or local_transport_krw_max >= 0),
  parent_stay_per_week_krw_min integer null check (parent_stay_per_week_krw_min is null or parent_stay_per_week_krw_min >= 0),
  parent_stay_per_week_krw_max integer null check (parent_stay_per_week_krw_max is null or parent_stay_per_week_krw_max >= 0),
  contingency_buffer_rate numeric not null default 0.1 check (contingency_buffer_rate >= 0),
  source_status text not null default 'manual_estimate' check (
    source_status in ('manual_estimate', 'verified', 'needs_update')
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    flight_per_person_krw_min is null
    or flight_per_person_krw_max is null
    or flight_per_person_krw_min <= flight_per_person_krw_max
  ),
  check (
    visa_insurance_krw_min is null
    or visa_insurance_krw_max is null
    or visa_insurance_krw_min <= visa_insurance_krw_max
  ),
  check (
    local_transport_krw_min is null
    or local_transport_krw_max is null
    or local_transport_krw_min <= local_transport_krw_max
  ),
  check (
    parent_stay_per_week_krw_min is null
    or parent_stay_per_week_krw_max is null
    or parent_stay_per_week_krw_min <= parent_stay_per_week_krw_max
  )
);

create trigger campfit_v2_sessions_updated_at
before update on public.campfit_v2_sessions
for each row execute function public.set_campfit_v2_updated_at();

create trigger campfit_v2_required_intakes_updated_at
before update on public.campfit_v2_required_intakes
for each row execute function public.set_campfit_v2_updated_at();

create trigger campfit_v2_natural_inputs_updated_at
before update on public.campfit_v2_natural_inputs
for each row execute function public.set_campfit_v2_updated_at();

create trigger campfit_v2_question_bank_updated_at
before update on public.campfit_v2_question_bank
for each row execute function public.set_campfit_v2_updated_at();

create trigger campfit_v2_consulting_profiles_updated_at
before update on public.campfit_v2_consulting_profiles
for each row execute function public.set_campfit_v2_updated_at();

create trigger campfit_v2_travel_cost_assumptions_updated_at
before update on public.campfit_v2_travel_cost_assumptions
for each row execute function public.set_campfit_v2_updated_at();

create index if not exists campfit_v2_sessions_user_id_idx on public.campfit_v2_sessions(user_id);
create index if not exists campfit_v2_sessions_anonymous_session_id_idx on public.campfit_v2_sessions(anonymous_session_id);
create index if not exists campfit_v2_sessions_status_idx on public.campfit_v2_sessions(status);
create index if not exists campfit_v2_sessions_created_at_idx on public.campfit_v2_sessions(created_at);
create index if not exists campfit_v2_required_intakes_session_id_idx on public.campfit_v2_required_intakes(session_id);
create index if not exists campfit_v2_natural_inputs_session_id_idx on public.campfit_v2_natural_inputs(session_id);
create index if not exists campfit_v2_ai_extractions_session_id_idx on public.campfit_v2_ai_extractions(session_id);
create index if not exists campfit_v2_ai_extractions_created_at_idx on public.campfit_v2_ai_extractions(created_at);
create index if not exists campfit_v2_question_bank_question_key_idx on public.campfit_v2_question_bank(question_key);
create index if not exists campfit_v2_question_bank_active_idx on public.campfit_v2_question_bank(active);
create index if not exists campfit_v2_dynamic_questions_session_id_idx on public.campfit_v2_dynamic_questions(session_id);
create index if not exists campfit_v2_dynamic_questions_question_key_idx on public.campfit_v2_dynamic_questions(question_key);
create index if not exists campfit_v2_dynamic_questions_status_idx on public.campfit_v2_dynamic_questions(status);
create index if not exists campfit_v2_dynamic_questions_created_at_idx on public.campfit_v2_dynamic_questions(created_at);
create index if not exists campfit_v2_dynamic_answers_session_id_idx on public.campfit_v2_dynamic_answers(session_id);
create index if not exists campfit_v2_dynamic_answers_question_key_idx on public.campfit_v2_dynamic_answers(question_key);
create index if not exists campfit_v2_consulting_profiles_session_id_idx on public.campfit_v2_consulting_profiles(session_id);
create index if not exists campfit_v2_recommendation_runs_session_id_idx on public.campfit_v2_recommendation_runs(session_id);
create index if not exists campfit_v2_recommendation_runs_created_at_idx on public.campfit_v2_recommendation_runs(created_at);
create index if not exists campfit_v2_travel_cost_assumptions_active_idx on public.campfit_v2_travel_cost_assumptions(active);
create index if not exists campfit_v2_travel_cost_assumptions_region_group_idx on public.campfit_v2_travel_cost_assumptions(region_group);

alter table public.campfit_v2_sessions enable row level security;
alter table public.campfit_v2_required_intakes enable row level security;
alter table public.campfit_v2_natural_inputs enable row level security;
alter table public.campfit_v2_ai_extractions enable row level security;
alter table public.campfit_v2_question_bank enable row level security;
alter table public.campfit_v2_dynamic_questions enable row level security;
alter table public.campfit_v2_dynamic_answers enable row level security;
alter table public.campfit_v2_consulting_profiles enable row level security;
alter table public.campfit_v2_recommendation_runs enable row level security;
alter table public.campfit_v2_travel_cost_assumptions enable row level security;

create policy "campfit_v2_sessions_service_role_all"
  on public.campfit_v2_sessions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_required_intakes_service_role_all"
  on public.campfit_v2_required_intakes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_natural_inputs_service_role_all"
  on public.campfit_v2_natural_inputs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_ai_extractions_service_role_all"
  on public.campfit_v2_ai_extractions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_question_bank_service_role_all"
  on public.campfit_v2_question_bank for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_dynamic_questions_service_role_all"
  on public.campfit_v2_dynamic_questions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_dynamic_answers_service_role_all"
  on public.campfit_v2_dynamic_answers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_consulting_profiles_service_role_all"
  on public.campfit_v2_consulting_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_recommendation_runs_service_role_all"
  on public.campfit_v2_recommendation_runs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "campfit_v2_travel_cost_assumptions_service_role_all"
  on public.campfit_v2_travel_cost_assumptions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.campfit_v2_question_bank (
  question_key,
  phase,
  slot_key,
  priority,
  question_type,
  title,
  helper_text,
  options
)
values
  ('child_age_at_start', 'required_intake', 'child_age_at_start', 10, 'number', '캠프 시작 시점 기준 아이 만 나이는 몇 살인가요?', '국가별 학제 대신 실제 만 나이로 추천 가능 여부를 판단합니다.', '[]'::jsonb),
  ('departure_window', 'required_intake', 'departure_window', 20, 'single_choice', '희망 출발 시기는 언제인가요?', '정확하지 않다면 가장 가까운 범위를 선택해 주세요.', '[{"value":"winter_break","label":"겨울방학"},{"value":"summer_break","label":"여름방학"},{"value":"within_3_months","label":"3개월 이내"},{"value":"within_6_months","label":"6개월 이내"},{"value":"within_1_year","label":"1년 이내"},{"value":"undecided","label":"아직 미정입니다"}]'::jsonb),
  ('duration_weeks', 'required_intake', 'duration_weeks', 30, 'single_choice', '가능한 캠프 기간은 어느 정도인가요?', '최소와 최대 기간을 정하면 후보를 더 안정적으로 좁힐 수 있습니다.', '[{"value":"1w","label":"1주"},{"value":"2w","label":"2주"},{"value":"3_4w","label":"3~4주"},{"value":"over_4w","label":"4주 이상"},{"value":"undecided","label":"아직 미정입니다"}]'::jsonb),
  ('total_budget_all_in', 'required_intake', 'total_budget_all_in_krw', 40, 'number', '항공권 포함 총예산은 어느 정도인가요?', '항공권, 숙소, 식비, 보험, 현지 이동비까지 포함한 전체 예산 기준입니다.', '[]'::jsonb),
  ('budget_scope', 'required_intake', 'budget_scope', 50, 'single_choice', '이 예산은 누구 기준인가요?', '이동 인원과 함께 실제 캠프비로 쓸 수 있는 범위를 계산하는 데 사용합니다.', '[{"value":"child_only","label":"아이 1명 기준"},{"value":"child_plus_one_parent","label":"아이 + 부모 1명 기준"},{"value":"family_total","label":"가족 전체 기준"},{"value":"unknown","label":"아직 정확하지 않음"}]'::jsonb),
  ('traveler_count', 'required_intake', 'traveler_counts', 60, 'number', '함께 이동하는 인원은 몇 명인가요?', '아이, 부모, 형제자매 인원을 나누어 입력합니다.', '[]'::jsonb),
  ('preferred_regions', 'required_intake', 'preferred_region_groups', 70, 'multi_choice', '선호 지역이 있나요?', '여러 지역을 선택하거나 아직 미정으로 둘 수 있습니다.', '[{"value":"southeast_asia","label":"동남아"},{"value":"oceania","label":"오세아니아"},{"value":"north_america","label":"북미"},{"value":"europe","label":"유럽"},{"value":"domestic","label":"국내"},{"value":"no_preference","label":"상관없음"},{"value":"undecided","label":"아직 미정"}]'::jsonb),
  ('region_priority', 'required_intake', 'region_priority', 80, 'single_choice', '지역 선호는 얼마나 중요한가요?', '강한 조건인지 대안 탐색이 가능한지 구분합니다.', '[{"value":"hard","label":"반드시 맞아야 합니다"},{"value":"strong","label":"가능하면 지키고 싶습니다"},{"value":"flexible","label":"아이에게 맞으면 조정 가능합니다"},{"value":"low","label":"중요도가 낮습니다"}]'::jsonb),
  ('parent_accompaniment_mode', 'required_intake', 'parent_accompaniment_mode', 90, 'single_choice', '부모 동행은 어떤 형태까지 가능한가요?', '부모 체류 필요 여부는 후보 제외 기준이 될 수 있습니다.', '[{"value":"parent_required","label":"부모 동행이 반드시 필요합니다"},{"value":"parent_can_stay","label":"필요하면 부모가 머물 수 있습니다"},{"value":"departure_arrival_only","label":"출도착 동행 정도만 가능합니다"},{"value":"child_solo_or_chaperone_ok","label":"아이 단독 또는 인솔 동행도 괜찮습니다"},{"value":"undecided","label":"아직 미정입니다"}]'::jsonb),
  ('korean_support_need', 'required_intake', 'korean_support_need', 100, 'single_choice', '한국어 지원은 어느 정도 필요할까요?', '안전 관리와 초기 적응 지원 수준을 판단합니다.', '[{"value":"resident_korean_manager","label":"상주 한국인 매니저가 필요합니다"},{"value":"daily_korean_communication","label":"매일 한국어 소통이 가능하면 좋겠습니다"},{"value":"emergency_only","label":"응급 상황에만 가능해도 됩니다"},{"value":"not_needed","label":"필수는 아닙니다"},{"value":"undecided","label":"아직 미정입니다"}]'::jsonb),
  ('accommodation_preferences', 'required_intake', 'accommodation_preferences', 110, 'multi_choice', '허용 가능한 숙소 형태를 선택해 주세요.', '숙소 형태는 아이 독립성 및 부모 동행 조건과 함께 판단합니다.', '[{"value":"parent_stay","label":"부모 동반 체류"},{"value":"homestay","label":"홈스테이"},{"value":"dormitory","label":"기숙사"},{"value":"hotel_resort","label":"호텔/리조트"},{"value":"day_only","label":"데이캠프만"},{"value":"undecided","label":"아직 미정"}]'::jsonb),
  ('english_comprehension', 'dynamic_followup', 'english_comprehension', 120, 'single_choice', '아이가 영어로 된 지시를 들으면 어느 정도 이해하나요?', '수업과 생활 지시를 따라갈 수 있는지 확인합니다.', '[{"value":"very_low","label":"거의 이해하지 못합니다.","score":1},{"value":"words_only","label":"단어 몇 개나 익숙한 표현만 알아듣습니다.","score":2},{"value":"basic_instructions","label":"짧은 생활 지시는 알아듣습니다.","score":3},{"value":"simple_classroom","label":"선생님의 간단한 설명을 따라갈 수 있습니다.","score":4},{"value":"comfortable","label":"영어 환경에서도 큰 불편 없이 참여합니다.","score":5}]'::jsonb),
  ('english_help_seeking', 'dynamic_followup', 'english_help_seeking', 130, 'single_choice', '아이가 영어로 도움을 요청할 수 있나요?', '아프거나 불편할 때 도움을 요청할 수 있는지가 안전 판단에 중요합니다.', '[{"value":"very_low","label":"거의 어렵습니다.","score":1},{"value":"memorized_phrases","label":"정해진 표현 몇 개만 가능합니다.","score":2},{"value":"basic_needs","label":"화장실, 아픔, 싫음 정도는 말할 수 있습니다.","score":3},{"value":"simple_explanation","label":"필요한 상황을 간단히 설명할 수 있습니다.","score":4},{"value":"independent","label":"스스로 질문하고 도움을 요청할 수 있습니다.","score":5}]'::jsonb),
  ('english_speaking_anxiety', 'dynamic_followup', 'english_speaking_anxiety', 140, 'single_choice', '영어를 말해야 하는 상황에서 아이 반응은 어떤가요?', '영어 노출이 부담이 될지 성장 자극이 될지 판단합니다.', '[{"value":"freezes","label":"틀릴까 봐 거의 말하지 않으려 합니다.","score":1},{"value":"shy_with_strangers","label":"익숙한 사람 앞에서는 말하지만 낯선 사람 앞에서는 위축됩니다.","score":2},{"value":"tries_short_phrases","label":"짧은 표현은 시도합니다.","score":3},{"value":"tries_despite_mistakes","label":"틀려도 어느 정도 말하려고 합니다.","score":4},{"value":"active_speaker","label":"적극적으로 말하려고 합니다.","score":5}]'::jsonb),
  ('separation_experience', 'dynamic_followup', 'separation_experience', 150, 'single_choice', '부모와 떨어져 지낸 가장 긴 경험은 무엇인가요?', '기숙형, 홈스테이, 단독 참여 가능성을 판단합니다.', '[{"value":"school_only","label":"어린이집/학교 정도"},{"value":"half_day_activity","label":"반나절 체험활동"},{"value":"one_day_camp","label":"1일 캠프"},{"value":"overnight_domestic","label":"1박 이상 국내 캠프"},{"value":"overseas_or_long_distance","label":"해외 또는 장거리 캠프 경험 있음"}]'::jsonb),
  ('transition_readiness', 'dynamic_followup', 'transition_readiness', 160, 'single_choice', '부모 없이 새로운 수업이나 활동에 들어갈 때 아이는 보통 어떤가요?', '초기 적응 지원의 필요 수준을 판단합니다.', '[{"value":"strong_refusal","label":"강하게 거부하거나 울 수 있습니다.","score":1},{"value":"needs_familiar_adult","label":"처음에는 불안하지만 익숙한 어른이 있으면 가능합니다.","score":2},{"value":"adapts_after_2_3_sessions","label":"첫날은 힘들지만 2~3회차부터 적응합니다.","score":3},{"value":"generally_ok","label":"낯선 환경도 대체로 들어갑니다.","score":4},{"value":"likes_new_activities","label":"새로운 활동을 좋아하고 독립적으로 참여합니다.","score":5}]'::jsonb),
  ('social_confidence', 'dynamic_followup', 'social_confidence', 170, 'single_choice', '낯선 친구들과 함께 있을 때 아이는 어떤 편인가요?', '또래 교류 중심 프로그램의 적합도를 판단합니다.', '[{"value":"observes_long_time","label":"오래 관찰하고 먼저 다가가기 어렵습니다.","score":1},{"value":"slow_start","label":"익숙해지면 어울리지만 시작이 어렵습니다.","score":2},{"value":"one_or_two_friends","label":"한두 명과는 잘 어울립니다.","score":3},{"value":"group_ok","label":"그룹 활동도 무난합니다.","score":4},{"value":"actively_leads","label":"적극적으로 친구를 만들고 리드합니다.","score":5}]'::jsonb),
  ('adaptability', 'dynamic_followup', 'adaptability', 180, 'single_choice', '새로운 장소에 적응하는 데 보통 얼마나 걸리나요?', '지역 이동과 숙소 변화에 대한 부담을 판단합니다.', '[{"value":"several_days","label":"며칠 이상 걸립니다."},{"value":"about_one_day","label":"하루 정도 시간이 필요합니다."},{"value":"half_day","label":"반나절 정도면 괜찮아집니다."},{"value":"quickly","label":"금방 적응합니다."},{"value":"depends","label":"장소에 따라 차이가 큽니다."}]'::jsonb),
  ('resilience', 'dynamic_followup', 'resilience', 190, 'single_choice', '아이가 피곤하거나 뜻대로 안 될 때 보통 어떤 반응을 보이나요?', '강도 높은 일정에서 회복 가능성을 판단합니다.', '[{"value":"strong_rejection","label":"울거나 강하게 거부할 수 있습니다.","score":1},{"value":"withdraws","label":"말수가 줄고 위축됩니다.","score":2},{"value":"recovers_after_irritation","label":"짜증은 내지만 회복합니다.","score":3},{"value":"recovers_with_help","label":"도움을 받으면 다시 참여합니다.","score":4},{"value":"self_regulates","label":"스스로 감정을 조절하고 이어갑니다.","score":5}]'::jsonb),
  ('daily_life_independence', 'dynamic_followup', 'daily_life_independence', 200, 'single_choice', '아이의 생활 독립성은 어느 정도인가요?', '숙소형 프로그램과 생활 관리 수준을 판단합니다.', '[{"value":"needs_much_help","label":"식사, 화장실, 준비물 챙기기에서 어른 도움이 많이 필요합니다.","score":1},{"value":"needs_help_in_new_places","label":"익숙한 환경에서는 가능하지만 낯선 곳에서는 도움이 필요합니다.","score":2},{"value":"basic_independent","label":"기본적인 생활은 스스로 가능합니다.","score":3},{"value":"group_life_ok","label":"단체생활에서도 큰 문제 없이 챙깁니다.","score":4},{"value":"boarding_ready","label":"기숙형 생활도 가능할 정도로 독립적입니다.","score":5}]'::jsonb),
  ('activity_tolerance', 'dynamic_followup', 'activity_tolerance', 210, 'single_choice', '하루 일정이 길거나 활동량이 많을 때 아이는 어떤가요?', '스포츠/액티비티형 캠프의 적합도를 판단합니다.', '[{"value":"tires_easily","label":"쉽게 지치고 쉬는 시간이 많이 필요합니다.","score":1},{"value":"half_day_ok","label":"반나절 정도는 괜찮습니다.","score":2},{"value":"normal_day_ok","label":"일반적인 하루 일정은 가능합니다.","score":3},{"value":"active_schedule_ok","label":"활동이 많은 일정도 대체로 가능합니다.","score":4},{"value":"very_active","label":"활동량이 많을수록 좋아합니다.","score":5}]'::jsonb),
  ('primary_goals', 'dynamic_followup', 'primary_goals', 220, 'multi_choice', '이번 캠프에서 가장 기대하는 변화는 무엇인가요? 최대 2개만 선택해주세요.', '가장 중요한 기대 효과를 기준으로 후보군을 우선순위화합니다.', '[{"value":"reduce_english_resistance","label":"영어에 대한 거부감 줄이기"},{"value":"real_english_use","label":"실제 영어 사용 경험"},{"value":"english_improvement","label":"영어 실력 향상"},{"value":"confidence","label":"자신감 회복"},{"value":"independence","label":"독립심 기르기"},{"value":"foreign_peers","label":"외국 친구와 어울리기"},{"value":"international_school_exposure","label":"국제학교/해외학교 분위기 체험"},{"value":"academic_stimulation","label":"학업적 자극"},{"value":"activities","label":"다양한 액티비티 경험"},{"value":"study_abroad_trial","label":"장기 유학/한달살기 전 테스트"},{"value":"safe_care","label":"방학 돌봄과 안전한 관리"}]'::jsonb),
  ('challenge_preference', 'dynamic_followup', 'challenge_preference', 230, 'single_choice', '이번 캠프는 어느 정도의 도전이 적당할까요?', '안정형과 성장형 후보의 균형을 정합니다.', '[{"value":"very_safe","label":"무리하지 않는 안정형이 좋습니다."},{"value":"gentle_stretch","label":"약간의 도전은 괜찮습니다."},{"value":"balanced","label":"안정과 도전의 균형이 좋습니다."},{"value":"challenging","label":"아이가 성장할 수 있다면 도전적이어도 괜찮습니다."},{"value":"undecided","label":"아직 잘 모르겠습니다."}]'::jsonb),
  ('preferred_program_types', 'dynamic_followup', 'preferred_program_types', 240, 'multi_choice', '선호하는 프로그램 유형은 무엇인가요? 최대 3개만 선택해주세요.', '희망 프로그램 유형을 후보군 우선순위에 반영합니다.', '[{"value":"international_school_regular","label":"국제학교 정규수업 체험"},{"value":"international_school_camp","label":"국제학교 방학캠프"},{"value":"language_school_esl","label":"어학원 ESL"},{"value":"family_esl","label":"가족동반 ESL"},{"value":"managed_immersion","label":"관리형 영어몰입"},{"value":"activity_sports","label":"액티비티/스포츠 캠프"},{"value":"steam_project","label":"STEAM/프로젝트 캠프"},{"value":"homestay_schooling","label":"홈스테이+학교체험"},{"value":"residential_international_camp","label":"기숙형 국제캠프"},{"value":"undecided","label":"아직 잘 모르겠습니다"}]'::jsonb),
  ('international_school_intent', 'dynamic_followup', 'international_school_intent', 250, 'single_choice', '국제학교 경험이 중요하다면, 어떤 의미에 더 가까운가요?', '정규수업 체험과 분위기 체험을 구분합니다.', '[{"value":"regular_class","label":"실제 정규수업을 들어보는 것이 중요합니다."},{"value":"atmosphere_and_peers","label":"국제학교 분위기와 외국 친구 경험이면 충분합니다."},{"value":"study_abroad_trial","label":"장기 유학 전 테스트 목적입니다."},{"value":"interest_check","label":"학업보다 아이가 흥미를 느끼는지 보는 것이 중요합니다."},{"value":"undecided","label":"아직 잘 모르겠습니다."}]'::jsonb),
  ('english_outcome_expectation', 'dynamic_followup', 'english_outcome_expectation', 260, 'single_choice', '영어 결과에 대한 기대는 어느 쪽에 가까운가요?', '단기 실력 향상과 태도 변화를 구분해 추천합니다.', '[{"value":"reduce_resistance","label":"영어 거부감이 줄면 좋겠습니다."},{"value":"use_confidently","label":"실제로 써보는 자신감이 중요합니다."},{"value":"visible_improvement","label":"눈에 보이는 실력 향상을 기대합니다."},{"value":"academic_readiness","label":"학업 영어 준비가 중요합니다."},{"value":"undecided","label":"아직 잘 모르겠습니다."}]'::jsonb),
  ('korean_peer_ratio_preference', 'dynamic_followup', 'korean_peer_ratio_preference', 270, 'single_choice', '한국 아이 비율에 대해서는 어떤 생각이신가요?', '다국적 환경 선호와 초기 안정감을 함께 판단합니다.', '[{"value":"as_low_as_possible","label":"한국 아이가 적을수록 좋습니다."},{"value":"not_too_many","label":"너무 많지만 않으면 괜찮습니다."},{"value":"some_korean_peers","label":"첫 캠프라 한국 친구가 어느 정도 있으면 좋겠습니다."},{"value":"does_not_matter","label":"한국 아이 비율은 크게 상관없습니다."},{"value":"undecided","label":"잘 모르겠습니다."}]'::jsonb),
  ('top_concerns', 'dynamic_followup', 'top_concerns', 280, 'multi_choice', '가장 걱정되는 부분은 무엇인가요? 최대 3개만 선택해주세요.', '상담 리포트에서 반드시 확인해야 할 리스크를 정합니다.', '[{"value":"english_understanding","label":"아이가 영어를 못 알아들을까 봐 걱정됩니다."},{"value":"making_friends","label":"친구를 못 사귈까 봐 걱정됩니다."},{"value":"separation","label":"부모와 떨어져 힘들어할까 봐 걱정됩니다."},{"value":"safety_management","label":"안전/관리 수준이 걱정됩니다."},{"value":"korean_support","label":"한국어 지원이 없으면 불안합니다."},{"value":"too_many_koreans","label":"한국 아이들끼리만 지내다 올까 봐 걱정됩니다."},{"value":"value_for_money","label":"비용 대비 효과가 없을까 봐 걱정됩니다."},{"value":"ad_vs_reality","label":"광고와 실제 운영이 다를까 봐 걱정됩니다."},{"value":"living_logistics","label":"숙소/식사/이동 관리가 걱정됩니다."},{"value":"negative_backfire","label":"아이가 너무 힘들어해서 역효과가 날까 봐 걱정됩니다."}]'::jsonb),
  ('avoid_conditions', 'dynamic_followup', 'avoid_conditions', 290, 'multi_choice', '아래 중 절대 피하고 싶은 조건이 있나요? 최대 3개만 선택해주세요.', '후보 제외 사유와 완화 가능성을 분리합니다.', '[{"value":"full_boarding_separation","label":"부모와 완전히 떨어지는 기숙형"},{"value":"little_korean_support","label":"한국어 지원이 거의 없는 프로그램"},{"value":"high_academic_intensity","label":"학업 강도가 높은 프로그램"},{"value":"too_little_english","label":"영어 수업이 너무 적은 프로그램"},{"value":"high_korean_ratio","label":"한국 아이 비율이 높은 프로그램"},{"value":"long_transfer_time","label":"이동 시간이 긴 지역"},{"value":"unclear_accommodation","label":"숙소 정보가 불명확한 프로그램"},{"value":"unclear_total_cost","label":"총비용이 불명확한 프로그램"},{"value":"unclear_operator","label":"운영 주체가 명확하지 않은 프로그램"},{"value":"none","label":"특별히 없음"}]'::jsonb),
  ('unacceptable_outcome', 'dynamic_followup', 'unacceptable_outcome', 300, 'text', '이번 캠프에서 절대 피하고 싶은 결과가 있다면 적어주세요.', '추천 제외 기준을 더 명확히 하기 위한 질문입니다.', '[]'::jsonb),
  ('flexibility', 'dynamic_followup', 'flexibility', 310, 'multi_choice', '원하는 조건에 딱 맞는 후보가 부족하다면, 어떤 조건을 조정할 수 있나요?', '추천 없음과 조건 완화안을 판단합니다.', '[{"value":"raise_budget","label":"예산을 일부 올릴 수 있습니다."},{"value":"expand_region","label":"지역을 넓힐 수 있습니다."},{"value":"adjust_duration","label":"기간을 늘리거나 줄일 수 있습니다."},{"value":"adjust_departure","label":"출발 시기를 바꿀 수 있습니다."},{"value":"adjust_parent_accompaniment","label":"부모 동행 조건을 조정할 수 있습니다."},{"value":"adjust_korean_support","label":"한국어 지원 조건을 조정할 수 있습니다."},{"value":"adjust_program_type","label":"프로그램 유형을 바꿀 수 있습니다."},{"value":"prefer_no_recommendation","label":"조건이 안 맞으면 추천받지 않는 편이 낫습니다."}]'::jsonb),
  ('mismatch_tolerance', 'dynamic_followup', 'mismatch_tolerance', 320, 'single_choice', '후보가 조건에 일부 맞지 않아도 추천할 수 있는 경우는 언제인가요?', '대안 후보를 보여줄 수 있는 범위를 정합니다.', '[{"value":"child_fit","label":"아이에게 정말 잘 맞는다면 괜찮습니다."},{"value":"safety_management","label":"안전/관리 조건이 좋다면 괜찮습니다."},{"value":"budget_fit","label":"예산만 맞으면 괜찮습니다."},{"value":"region_flexible","label":"선호 지역이 아니어도 괜찮습니다."},{"value":"program_type_flexible","label":"프로그램 유형이 조금 달라도 괜찮습니다."},{"value":"no_mismatch","label":"조건에 안 맞으면 추천하지 않았으면 합니다."}]'::jsonb),
  ('special_care_needs', 'dynamic_followup', 'special_care_needs', 330, 'text', '알레르기, 건강, 생활 습관 등 특별히 챙겨야 할 점이 있나요?', '운영사 확인이 필요한 케어 조건을 남깁니다.', '[]'::jsonb),
  ('conflict_oceania_budget_parent', 'conflict_resolution', 'conflict_oceania_budget_parent', 30, 'single_choice', '현재 조건에서는 오세아니아 후보가 예산과 부모 동행 조건에서 제한될 가능성이 있습니다. 이 경우 어떤 방향이 더 적합할까요?', '조건 충돌을 풀기 위한 우선순위 질문입니다.', '[{"value":"raise_budget_keep_oceania","label":"오세아니아를 유지하고 예산을 올릴 수 있습니다."},{"value":"expand_region_keep_budget","label":"예산을 유지하고 지역을 동남아까지 넓힐 수 있습니다."},{"value":"change_to_camp_style","label":"프로그램 유형을 스쿨링에서 캠프형으로 바꿀 수 있습니다."},{"value":"no_recommendation_if_no_match","label":"조건이 맞지 않으면 추천 없음으로 보는 것이 좋습니다."}]'::jsonb),
  ('conflict_schooling_low_english', 'conflict_resolution', 'conflict_schooling_low_english', 40, 'single_choice', '국제학교 정규수업은 방향성은 맞지만, 현재 아이의 영어 준비도 기준에서는 부담이 클 수 있습니다. 부모님이 원하시는 국제학교 경험은 어느 쪽에 더 가깝나요?', '스쿨링 후보의 부담과 목적을 구분합니다.', '[{"value":"regular_class_is_important","label":"실제 정규수업 참여가 중요합니다."},{"value":"atmosphere_is_enough","label":"국제학교 분위기와 외국 친구 경험이면 충분합니다."},{"value":"avoid_overload","label":"아이가 무리하지 않는 것이 더 중요합니다."},{"value":"trial_for_study_abroad","label":"장기 유학 전 테스트라 어느 정도 부담도 감수할 수 있습니다."}]'::jsonb),
  ('conflict_low_korean_ratio_high_korean_support', 'conflict_resolution', 'conflict_low_korean_ratio_high_korean_support', 50, 'single_choice', '한국 아이 비율을 낮추는 것과 한국어 관리 안정성을 높이는 것은 일부 프로그램에서 충돌할 수 있습니다. 어느 쪽을 더 우선하시나요?', '환경 몰입도와 관리 안정성의 우선순위를 정합니다.', '[{"value":"multinational_environment","label":"현지/다국적 환경이 더 중요합니다."},{"value":"korean_support_stability","label":"한국어 관리 안정성이 더 중요합니다."},{"value":"balanced_first_camp","label":"첫 캠프이므로 중간 정도 균형이 좋습니다."},{"value":"depends_on_child_fit","label":"아이에게 맞다면 상관없습니다."}]'::jsonb),
  ('conflict_independence_parent_anxiety', 'conflict_resolution', 'conflict_independence_parent_anxiety', 60, 'single_choice', '아이의 독립심 성장을 기대하지만 부모와 떨어지는 것에 대한 걱정도 큽니다. 어느 쪽을 더 우선할까요?', '독립성 목표와 초기 안정성 사이의 우선순위를 정합니다.', '[{"value":"prioritize_stability","label":"처음에는 안정적으로 적응하는 것이 더 중요합니다."},{"value":"gentle_independence","label":"짧은 분리부터 천천히 시도하고 싶습니다."},{"value":"structured_independence","label":"관리 체계가 좋다면 독립적인 참여도 가능합니다."},{"value":"prioritize_growth","label":"아이 성장에 도움이 된다면 어느 정도 분리도 감수합니다."}]'::jsonb),
  ('conflict_english_outcome_activity_preference', 'conflict_resolution', 'conflict_english_outcome_activity_preference', 70, 'single_choice', '영어 성과 기대가 크지만 액티비티형 프로그램을 선호하는 경우 영어 수업 밀도와 즐거움이 충돌할 수 있습니다. 무엇을 더 우선할까요?', '영어 학습 밀도와 활동 경험의 균형을 정합니다.', '[{"value":"english_intensity","label":"영어 수업과 결과를 더 우선합니다."},{"value":"activity_engagement","label":"아이가 즐겁게 참여하는 경험을 더 우선합니다."},{"value":"balanced_mix","label":"영어와 액티비티가 균형 잡힌 구성이 좋습니다."},{"value":"decide_by_child_readiness","label":"아이 준비도에 맞춰 정하고 싶습니다."}]'::jsonb)
on conflict (question_key) do update set
  phase = excluded.phase,
  slot_key = excluded.slot_key,
  priority = excluded.priority,
  question_type = excluded.question_type,
  title = excluded.title,
  helper_text = excluded.helper_text,
  options = excluded.options,
  active = true,
  updated_at = now();
