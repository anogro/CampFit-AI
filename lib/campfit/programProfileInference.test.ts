import { describe, expect, it } from "vitest"
import { buildCampFromCatalog } from "@/lib/campfit/programProfileInference"
import type { PriceOptionRow, ProgramProfileRow, ProgramRow } from "@/lib/campfit/programCatalogSchemas"

const baseProgram = {
  id: "program-1",
  name: "Old profile-facing name",
  title: "2026 세부 가족 영어캠프",
  slug: "cebu-family-camp-2026",
  program_type: "방학캠프",
  program_focus: "영어몰입형",
  host_institution: "Cebu ESL",
  organizer: "ANOGRO",
  detailed_description: "부모 동반 가족캠프이며 초급 학생을 위한 영어 수업과 한국어 상담을 제공합니다.",
  short_description: "가족형 영어캠프",
  subtitle: "부모님과 함께 시작하는 초급 영어몰입",
  price_details: "4주 보호자1+자녀1 678만원",
  display_price: "4주 678만원",
  minimum_price: "6780000",
  minimum_price_currency: "KRW",
  minimum_price_value: 6780000,
  base_price_currency: "KRW",
  base_price_value: 6780000,
  location_country: "Philippines",
  location_city: "Cebu",
  country: "Philippines",
  city: "Cebu",
  target_age: "만 7세 ~ 만 13세",
  age_min: null,
  age_max: null,
  duration: "4주",
  duration_options: "4주",
  minimum_duration: "4주",
  program_languages: "English, Korean",
  language_level: "초급~중급",
  group_composition: "부모동반/가족캠프",
  parent_participation_type: "부모 동반 권장",
  accommodation_type: "가족 기숙사",
  care_level: "생활 관리",
  care_types: "한국어 상담, 일일 리포트",
  local_presence: true,
  coverage_schedule: "수업 및 생활 관리",
  emergency_support: true,
  languages_supported: "한국어, 영어",
  onsite_manager: true,
  local_meeting_available: true,
  item_accommodation: "기숙사 포함",
  item_supervision_support: "한국어 생활 관리",
  item_transportation: null,
  item_education_program: "ESL",
  items_notes: "daily report",
  not_included: null,
  detail_payload: null,
  status: "draft",
  visible: true,
  is_listed: true,
} satisfies ProgramRow

const priceOptions = [
  {
    program_id: "program-1",
    duration_weeks: 4,
    currency: "KRW",
    price_value: 6780000,
    status: "active",
  },
] satisfies readonly PriceOptionRow[]

describe("buildCampFromCatalog", () => {
  it("Given listed program without profile When building catalog camp Then details are inferred from program fields", () => {
    const camp = buildCampFromCatalog({ program: baseProgram, prices: priceOptions, profile: undefined })

    expect(camp?.name).toBe("2026 세부 가족 영어캠프")
    expect(camp?.programType).toBe("family_esl")
    expect(camp?.durationWeeks).toContain("3_4w")
    expect(camp?.parentAccompanied).toBe(true)
    expect(camp?.koreanManager).toBe(true)
    expect(camp?.budgetMinKrw).toBe(6780000)
  })

  it("Given profile with stale program name When building catalog camp Then live product title stays authoritative", () => {
    const profile = {
      program_id: "program-1",
      program_name: "예전 캠프명",
      country: null,
      city: null,
      program_type: "managed_immersion",
      age_min: 8,
      age_max: 12,
      budget_min_krw: null,
      budget_max_krw: null,
      duration_weeks: ["3_4w"],
      korean_manager: true,
      parent_accompanied: false,
      korean_dorm_option: true,
      beginner_class: true,
      buddy_system: false,
      early_adaptation_support: true,
      daily_parent_report: true,
      low_pressure_speaking_environment: false,
      small_group_care: true,
      english_exposure: 4,
      boarding_independence: 3,
      academic_intensity: 4,
      foreign_peer_interaction: 3,
      parent_separation: 3,
      traits: ["관리형"],
      active: true,
    } satisfies ProgramProfileRow

    const camp = buildCampFromCatalog({ program: baseProgram, prices: priceOptions, profile })

    expect(camp?.name).toBe("2026 세부 가족 영어캠프")
    expect(camp?.programType).toBe("managed_immersion")
    expect(camp?.difficulty.englishExposure).toBe(0.8)
  })
})
