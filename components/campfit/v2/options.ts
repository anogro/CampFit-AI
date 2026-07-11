import type { AccommodationPreference, BudgetScope, DepartureWindow, KoreanSupportNeed, ParentAccompanimentMode, RegionGroup, RegionPriority, RequiredIntake } from "@/types/campfitV2"

export type SelectOption<T extends string> = {
  readonly value: T
  readonly label: string
}

export const departureWindowOptions = [
  { value: "winter_break", label: "이번 겨울방학" },
  { value: "summer_break", label: "다음 여름방학" },
  { value: "within_3_months", label: "3개월 이내" },
  { value: "within_6_months", label: "6개월 이내" },
  { value: "within_1_year", label: "1년 이내" },
  { value: "undecided", label: "아직 미정" },
] as const satisfies readonly SelectOption<DepartureWindow>[]

export const durationOptions = [
  { value: "1", label: "1주 이하", min: 1, max: 1 },
  { value: "2", label: "2주", min: 2, max: 2 },
  { value: "3", label: "3주", min: 3, max: 3 },
  { value: "4", label: "4주", min: 4, max: 4 },
  { value: "5", label: "5주 이상", min: 5, max: 8 },
  { value: "undecided", label: "아직 미정" },
] as const

export const budgetOptions = [
  { value: "under_3m", label: "300만 원 이하", min: 0, max: 3_000_000 },
  { value: "3m_5m", label: "300~500만 원", min: 3_000_000, max: 5_000_000 },
  { value: "5m_8m", label: "500~800만 원", min: 5_000_000, max: 8_000_000 },
  { value: "8m_12m", label: "800~1,200만 원", min: 8_000_000, max: 12_000_000 },
  { value: "12m_18m", label: "1,200~1,800만 원", min: 12_000_000, max: 18_000_000 },
  { value: "over_18m", label: "1,800만 원 이상", min: 18_000_000, max: 25_000_000 },
  { value: "unknown", label: "아직 감이 없습니다" },
] as const

export const budgetScopeOptions = [
  { value: "child_only", label: "아이 1명 기준" },
  { value: "child_plus_one_parent", label: "아이 + 부모 1명 기준" },
  { value: "family_total", label: "가족 전체 기준" },
  { value: "unknown", label: "아직 정확하지 않음" },
] as const satisfies readonly SelectOption<BudgetScope>[]

export const regionOptions = [
  { value: "southeast_asia", label: "동남아" },
  { value: "oceania", label: "오세아니아" },
  { value: "north_america", label: "북미" },
  { value: "europe", label: "유럽" },
  { value: "domestic", label: "국내 영어캠프" },
  { value: "undecided", label: "아직 잘 모르겠습니다" },
  { value: "no_preference", label: "지역은 크게 상관없습니다" },
] as const satisfies readonly SelectOption<RegionGroup>[]

export const regionPriorityOptions = [
  { value: "hard", label: "반드시 해당 지역이어야 합니다." },
  { value: "strong", label: "우선순위가 높지만 대안도 볼 수 있습니다." },
  { value: "flexible", label: "아이에게 맞으면 지역은 바꿀 수 있습니다." },
  { value: "low", label: "지역보다 예산/관리/아이 적합도가 더 중요합니다." },
] as const satisfies readonly SelectOption<RegionPriority>[]

export const parentAccompanimentOptions = [
  { value: "parent_required", label: "부모가 반드시 함께 있어야 합니다." },
  { value: "parent_can_stay", label: "부모가 현지에 머물 수 있습니다." },
  { value: "departure_arrival_only", label: "출국/입국만 동행하고 캠프 중에는 떨어져도 됩니다." },
  { value: "child_solo_or_chaperone_ok", label: "아이 혼자 또는 인솔자 동행도 가능합니다." },
  { value: "undecided", label: "아직 모르겠습니다." },
] as const satisfies readonly SelectOption<ParentAccompanimentMode>[]

export const koreanSupportOptions = [
  { value: "resident_korean_manager", label: "한국인 관리자가 상주해야 합니다." },
  { value: "daily_korean_communication", label: "매일 한국어 소통이 가능해야 합니다." },
  { value: "emergency_only", label: "비상 상황에만 한국어 지원이 있으면 됩니다." },
  { value: "not_needed", label: "없어도 괜찮습니다." },
  { value: "undecided", label: "잘 모르겠습니다." },
] as const satisfies readonly SelectOption<KoreanSupportNeed>[]

export const accommodationOptions = [
  { value: "parent_stay", label: "부모와 함께 숙박" },
  { value: "homestay", label: "홈스테이" },
  { value: "dormitory", label: "기숙사" },
  { value: "hotel_resort", label: "호텔/리조트" },
  { value: "day_only", label: "통학형" },
  { value: "undecided", label: "아직 모르겠습니다" },
] as const satisfies readonly SelectOption<AccommodationPreference>[]

export const initialRequiredIntake: RequiredIntake = {
  childAgeAtStart: 8,
  departureWindow: "summer_break",
  durationWeeksMin: 2,
  durationWeeksMax: 2,
  totalBudgetAllInKrwMin: 5_000_000,
  totalBudgetAllInKrwMax: 8_000_000,
  budgetScope: "family_total",
  travelerCounts: { child: 1, parent: 1, sibling: 0 },
  preferredRegionGroups: [],
  regionPriority: "strong",
  parentAccompanimentMode: "parent_can_stay",
  koreanSupportNeed: "daily_korean_communication",
  accommodationPreferences: [],
}
