import { countryRegion } from "@/lib/campfit/destinationFit"
import {
  avoidConditions,
  budgetEstimateForRegion,
  childAge,
  durationBounds,
  koreanSupportNeed,
  parentAccompanimentMode,
  preferredProgramTypes,
  preferredRegions,
  riskSignals,
  stringValue,
} from "@/lib/campfit/v2/profileAccess"
import type { Camp } from "@/types/campfit"
import type { ConsultingProfile, ExcludedCandidateV2, RecommendationTier, RegionGroup } from "@/types/campfitV2"

export function classifyRecommendationTierV2(input: {
  readonly v2Score: number
  readonly mismatchedConditions: readonly string[]
  readonly riskReasons: readonly string[]
}): RecommendationTier {
  if (input.riskReasons.length >= 3 || input.v2Score < 45) return "not_recommended"
  if (input.mismatchedConditions.length >= 2 || input.v2Score < 62) return "possible_if_adjusted"
  return input.v2Score >= 82 ? "best_fit" : "good_with_support"
}

export function buildMismatchReasons(camp: Camp, profile: ConsultingProfile): readonly string[] {
  const reasons: string[] = []
  const regions = preferredRegions(profile)
  const region = regionForCamp(camp)
  if (regions.length > 0 && !regions.includes(region)) {
    reasons.push(`선호 지역은 ${regions.join(", ")}였지만, 이 후보는 ${region}입니다.`)
  }

  if (normalizedProgramPreferences(profile).length > 0 && !normalizedProgramPreferences(profile).includes(camp.programType)) {
    reasons.push(`선호 프로그램 유형과 달리 이 후보는 ${camp.programType}에 가깝습니다.`)
  }

  if (koreanSupportNeed(profile) === "resident_korean_manager" && !camp.koreanManager) {
    reasons.push("한국인 관리자 상주 여부가 조건과 맞지 않습니다.")
  }

  if (budgetEstimateForRegion(profile, region)?.flags.includes("unknown_cost_assumption")) {
    reasons.push("항공권 포함 총예산 기준에서 상담 전 비용 확인이 필요합니다.")
  }

  return reasons
}

export function buildRecommendDespiteMismatchReason(
  camp: Camp,
  _profile: ConsultingProfile,
  mismatchReasons: readonly string[],
): string | undefined {
  if (mismatchReasons.length === 0) return undefined
  if (camp.koreanManager || camp.beginnerClass || camp.parentAccompanied) {
    return "아이의 현재 준비도와 부모님의 안전 관리 기준에는 더 잘 맞기 때문에 대안 후보로 제시했습니다."
  }

  return "선호와 일부 다르지만 아이 적합도, 안전성, 현실성을 함께 비교할 가치가 있어 대안으로 남겼습니다."
}

export function buildExcludedReasons(camp: Camp, profile: ConsultingProfile): readonly string[] {
  const reasons: string[] = []
  const age = childAge(profile)
  const region = regionForCamp(camp)
  const budget = budgetEstimateForRegion(profile, region)
  if (age < camp.ageMin || age > camp.ageMax) reasons.push("출발 시점 만 나이 조건과 맞지 않습니다.")
  if (!durationMatches(camp, durationBounds(profile))) reasons.push("희망 기간보다 최소 운영 기간이 깁니다.")
  if (parentAccompanimentMode(profile) === "parent_required" && !camp.parentAccompanied) reasons.push("부모 동행 필수 조건과 맞지 않습니다.")
  if (koreanSupportNeed(profile) === "resident_korean_manager" && !camp.koreanManager) reasons.push("한국어 지원 필수 조건을 충족하지 못합니다.")
  if (stringValue(profile.strongPreferences, "regionPriority") === "hard" && !preferredRegions(profile).includes(region)) reasons.push("지역을 필수 조건으로 설정했기 때문에 제외했습니다.")
  if (budget !== undefined && !budget.flags.includes("unknown_cost_assumption") && budget.availableProgramBudgetKrwMax !== undefined && camp.budgetMinKrw > budget.availableProgramBudgetKrwMax) {
    reasons.push("항공권 포함 총예산에서 예상 부대비를 제외하면 프로그램비가 부족할 가능성이 높습니다.")
  }

  if (avoidConditions(profile).includes("full_boarding_separation") && camp.difficulty.parentSeparation > 0.7) {
    reasons.push("피하고 싶은 조건에 가까운 분리형/기숙형 부담이 있습니다.")
  }

  return reasons
}

export function buildConditionRelaxationSuggestions(candidate: ExcludedCandidateV2, profile: ConsultingProfile): readonly string[] {
  return candidate.excludedReasons.map((reason) => {
    if (reason.includes("예산")) return "예산을 상향하면 재검토 가능합니다."
    if (reason.includes("기간")) return "기간을 3주 이상으로 늘리면 검토 가능합니다."
    if (reason.includes("지역")) return "지역을 동남아까지 확장하면 후보가 늘어납니다."
    if (reason.includes("한국어")) return "한국어 지원 조건을 상주에서 비상 지원으로 완화하면 현지형 후보가 늘어납니다."
    return profile.recommendationStrategy === "international_school_trial"
      ? "정규 스쿨링 대신 국제학교 방학캠프로 바꾸면 부담을 줄일 수 있습니다."
      : "조건 우선순위를 조정하면 재검토 가능합니다."
  })
}

export function buildMatchedConditions(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    childAge(profile) >= camp.ageMin && childAge(profile) <= camp.ageMax ? "나이 조건이 맞습니다." : "",
    preferredRegions(profile).includes(regionForCamp(camp)) ? "선호 지역과 일치합니다." : "",
    normalizedProgramPreferences(profile).includes(camp.programType) ? "선호 프로그램 유형과 가깝습니다." : "",
    camp.koreanManager ? "한국어 관리 지원이 있습니다." : "",
    camp.parentAccompanied ? "부모 동행이 가능합니다." : "",
  ].filter((item) => item.length > 0)
}

export function buildRiskReasons(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    riskSignals(profile).includes("english_overload") && camp.difficulty.academicIntensity > 0.65 ? "현재 영어 준비도 대비 학업 부담이 클 수 있습니다." : "",
    riskSignals(profile).includes("separation_risk") && camp.difficulty.parentSeparation > 0.65 ? "부모 분리 적응 부담이 클 수 있습니다." : "",
    budgetEstimateForRegion(profile, regionForCamp(camp))?.flags.includes("unknown_cost_assumption") ? "비용은 비교용 추정 전 단계라 상담 전 확인 필요입니다." : "",
  ].filter((item) => item.length > 0)
}

export function buildMitigation(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    camp.beginnerClass ? "초급반 운영 방식을 확인하세요." : "초급 영어 지원 가능 여부를 확인하세요.",
    camp.koreanManager ? "한국어 관리 범위와 시간대를 확인하세요." : "비상시 한국어 소통 경로를 확인하세요.",
    parentAccompanimentMode(profile) === "parent_required" ? "부모 체류 가능 일정과 아이 단독 참여 시간을 확인하세요." : "초기 적응 보고 체계를 확인하세요.",
  ]
}

export function buildConsultingChecklist(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    "실제 포함/불포함 비용을 상담 전 확인하세요.",
    ...(budgetEstimateForRegion(profile, regionForCamp(camp))?.flags.includes("unknown_cost_assumption") ? ["항공권/보험/현지 이동비는 상담 전 확인 필요입니다."] : []),
    "숙소, 식사, 이동 관리 담당자를 확인하세요.",
  ]
}

export function childFitText(camp: Camp, profile: ConsultingProfile): string {
  return riskSignals(profile).includes("english_overload") && camp.beginnerClass
    ? "영어 초급 부담을 완충할 장치가 있습니다."
    : "아이 준비도와 캠프 난이도를 상담에서 추가 확인해야 합니다."
}

export function familyFitText(camp: Camp, profile: ConsultingProfile): string {
  return parentAccompanimentMode(profile) === "parent_required" && camp.parentAccompanied
    ? "부모 동행 조건과 맞습니다."
    : "가족 이동과 생활 관리 조건을 함께 확인해야 합니다."
}

export function bucketRank(camp: Camp, regionSet: ReadonlySet<RegionGroup>, programSet: ReadonlySet<string>): number {
  const regionMatch = regionSet.has(regionForCamp(camp))
  const programMatch = programSet.has(camp.programType)
  return regionMatch && programMatch ? 1 : regionMatch ? 2 : programMatch ? 3 : 4
}

export function normalizedProgramPreferences(profile: ConsultingProfile): readonly string[] {
  return preferredProgramTypes(profile).map((value) => value.includes("school") ? "schooling" : value)
}

export function regionForCamp(camp: Camp): RegionGroup {
  return countryRegion(camp.country)
}

export function regionPriorityAdjustment(camp: Camp, profile: ConsultingProfile): number {
  const priority = stringValue(profile.strongPreferences, "regionPriority")
  const regions = preferredRegions(profile)
  if (regions.length === 0) return 0
  const matches = regions.includes(regionForCamp(camp))
  if (priority === "strong") return matches ? 25 : -35
  if (priority === "flexible") return matches ? 8 : 0
  return 0
}

function durationMatches(camp: Camp, duration: { readonly min?: number; readonly max?: number }): boolean {
  if (duration.min === undefined && duration.max === undefined) return true
  const requested = duration.max ?? duration.min ?? 0
  const option = requested <= 1 ? "1w" : requested <= 2 ? "2w" : requested <= 4 ? "3_4w" : "over_4w"
  return camp.durationWeeks.includes(option)
}
