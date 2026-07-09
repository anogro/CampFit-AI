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
import type { ConsultingProfile, ExcludedCandidateV2, FitScoreSummary, RecommendationTier, RegionGroup } from "@/types/campfitV2"

export function classifyRecommendationTierV2(input: {
  readonly v2Score: number
  readonly mismatchedConditions: readonly string[]
  readonly riskReasons: readonly string[]
}): RecommendationTier {
  if (input.riskReasons.length >= 3 || input.v2Score < 45) return "not_recommended"
  if (input.mismatchedConditions.length >= 2 || input.v2Score < 62) return "possible_if_adjusted"
  return input.v2Score >= 82 ? "best_fit" : "good_with_support"
}

export function buildFitScoreSummary(input: {
  readonly camp: Camp
  readonly profile: ConsultingProfile
  readonly tier: RecommendationTier
  readonly legacyScore: number
  readonly v2Score: number
  readonly matchedConditions: readonly string[]
  readonly mismatchedConditions: readonly string[]
  readonly riskReasons: readonly string[]
}): FitScoreSummary {
  const region = regionForCamp(input.camp)
  const budget = budgetEstimateForRegion(input.profile, region)
  const unknownCost = budget?.flags.includes("unknown_cost_assumption") ?? false
  const regionMatch = preferredRegions(input.profile).includes(region)
  const beginnerSupport = input.camp.beginnerClass || input.camp.lowPressureSpeaking
  const supportCount = [input.camp.koreanManager, input.camp.beginnerClass, input.camp.buddySystem, input.camp.smallGroupCare, input.camp.dailyParentReport].filter(Boolean).length
  const riskPenalty = input.riskReasons.length * 12
  const mismatchPenalty = input.mismatchedConditions.length * 10
  const overallScore = clampScore(Math.round(input.v2Score))

  return {
    overallScore,
    tier: input.tier,
    label: tierLabel(input.tier),
    axes: [
      {
        key: "child_fit",
        label: "아이 적응 적합도",
        score: clampScore(68 + supportCount * 4 - riskPenalty),
        comment: supportCount >= 3 ? "초반 적응을 도울 장치가 비교적 충분합니다." : "아이 성향에 맞는 초반 관리 방식 확인이 필요합니다.",
      },
      {
        key: "english_readiness",
        label: "영어 준비도 적합도",
        score: clampScore(beginnerSupport ? 74 : 55),
        comment: beginnerSupport ? "영어 초급 부담을 낮출 장치가 있습니다." : "수업 참여 부담은 상담 전 확인이 필요합니다.",
      },
      {
        key: "family_constraints",
        label: "부모 조건 적합도",
        score: clampScore(input.camp.parentAccompanied ? 78 : 58),
        comment: input.camp.parentAccompanied ? "부모 동행 또는 현지 체류 조건과 맞습니다." : "부모 체류 방식은 별도 확인이 필요합니다.",
      },
      {
        key: "support_fit",
        label: "지원장치 적합도",
        score: clampScore(52 + supportCount * 8),
        comment: supportCount >= 3 ? "한국어/초급/생활 관리 지원을 함께 검토할 수 있습니다." : "지원 범위가 충분한지 확인해야 합니다.",
      },
      {
        key: "growth_balance",
        label: "성장 자극 적합도",
        score: clampScore(70 + (input.camp.programType === "activity" || input.camp.programType === "international_camp" ? 8 : 0) - riskPenalty / 2),
        comment: "영어 노출과 문화 경험의 균형을 비교하는 점수입니다.",
      },
      {
        key: "budget_reality",
        label: "비용 현실성",
        score: unknownCost ? 60 : clampScore(75 - mismatchPenalty),
        comment: unknownCost ? "항공권 포함 총비용은 상담 전 확인 필요로 보았습니다." : "현재 예산 기준으로 비교했습니다.",
      },
      {
        key: "risk_management",
        label: "리스크 관리",
        score: clampScore(82 - riskPenalty + (regionMatch ? 4 : 0)),
        comment: input.riskReasons.length > 0 ? "확인할 리스크가 있어 지원 조건을 함께 봐야 합니다." : "큰 리스크 신호는 적게 잡혔습니다.",
      },
    ],
  }
}

export function buildMismatchReasons(camp: Camp, profile: ConsultingProfile): readonly string[] {
  const reasons: string[] = []
  const regions = preferredRegions(profile)
  const region = regionForCamp(camp)
  if (regions.length > 0 && !regions.includes(region)) {
    reasons.push(`선호 지역은 ${regions.map(regionLabel).join(", ")}이지만, 이 후보는 ${regionLabel(region)}입니다.`)
  }

  const preferredPrograms = normalizedProgramPreferences(profile)
  if (preferredPrograms.length > 0 && !preferredPrograms.includes(camp.programType)) {
    reasons.push(`선호 프로그램 유형과는 다르며, 이 후보는 ${programTypeLabel(camp.programType)}에 가깝습니다.`)
  }

  if (koreanSupportNeed(profile) === "resident_korean_manager" && !camp.koreanManager) {
    reasons.push("한국인 관리자 상주 조건과는 맞지 않을 수 있습니다.")
  }

  if (budgetEstimateForRegion(profile, region)?.flags.includes("unknown_cost_assumption")) {
    reasons.push("항공권 포함 총비용은 상담 전 확인이 필요합니다.")
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
    return "일부 조건은 다르지만, 아이의 준비도와 안전 관리 기준에는 잘 맞아 함께 검토해보시길 권합니다."
  }

  return "선호와 다른 지점은 있지만, 조건을 조금 조정하면 비교해볼 가치가 있는 대안입니다."
}

export function buildExcludedReasons(camp: Camp, profile: ConsultingProfile): readonly string[] {
  const reasons: string[] = []
  const age = childAge(profile)
  const region = regionForCamp(camp)
  const budget = budgetEstimateForRegion(profile, region)
  if (age < camp.ageMin || age > camp.ageMax) reasons.push("캠프 시작 시점의 아이 나이 조건과 맞지 않습니다.")
  if (!durationMatches(camp, durationBounds(profile))) reasons.push("희망 기간보다 최소 운영 기간이 깁니다.")
  if (parentAccompanimentMode(profile) === "parent_required" && !camp.parentAccompanied) reasons.push("부모 동행 필수 조건과 맞지 않습니다.")
  if (koreanSupportNeed(profile) === "resident_korean_manager" && !camp.koreanManager) reasons.push("한국어 지원 필수 조건을 충족하지 못합니다.")
  if (stringValue(profile.strongPreferences, "regionPriority") === "hard" && !preferredRegions(profile).includes(region)) reasons.push("지역을 반드시 지켜야 하는 조건과 맞지 않습니다.")
  if (budget !== undefined && !budget.flags.includes("unknown_cost_assumption") && budget.availableProgramBudgetKrwMax !== undefined && camp.budgetMinKrw > budget.availableProgramBudgetKrwMax) {
    reasons.push("항공권 포함 총예산에서 예상 부대비를 제외하면 프로그램비가 부족할 가능성이 높습니다.")
  }

  if (avoidConditions(profile).includes("full_boarding_separation") && camp.difficulty.parentSeparation > 0.7) {
    reasons.push("피하고 싶은 조건에 가까운 분리형 기숙 부담이 있습니다.")
  }

  return reasons
}

export function buildConditionRelaxationSuggestions(candidate: ExcludedCandidateV2, profile: ConsultingProfile): readonly string[] {
  return candidate.excludedReasons.map((reason) => {
    if (reason.includes("예산")) return "예산 범위를 올리면 재검토 가능합니다."
    if (reason.includes("기간")) return "기간을 3주 이상으로 늘리면 검토 가능합니다."
    if (reason.includes("지역")) return "지역을 동남아까지 넓히면 후보가 늘어납니다."
    if (reason.includes("한국어")) return "한국어 지원을 상주에서 비상 지원으로 완화하면 일부 후보가 열립니다."
    return profile.recommendationStrategy === "international_school_trial"
      ? "정규 스쿨링 대신 국제학교 방학캠프형으로 바꾸면 부담을 줄일 수 있습니다."
      : "조건 우선순위를 조정하면 재검토 가능합니다."
  })
}

export function buildMatchedConditions(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    childAge(profile) >= camp.ageMin && childAge(profile) <= camp.ageMax ? "아이 나이 조건과 맞습니다." : "",
    preferredRegions(profile).includes(regionForCamp(camp)) ? "선호 지역과 일치합니다." : "",
    normalizedProgramPreferences(profile).includes(camp.programType) ? "선호 프로그램 유형과 가깝습니다." : "",
    camp.koreanManager ? "한국어 관리 지원이 있습니다." : "",
    camp.parentAccompanied ? "부모 동행 또는 체류 검토가 가능합니다." : "",
  ].filter((item) => item.length > 0)
}

export function buildRiskReasons(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    riskSignals(profile).includes("english_overload") && camp.difficulty.academicIntensity > 0.65 ? "현재 영어 준비도 대비 수업 부담이 클 수 있습니다." : "",
    riskSignals(profile).includes("separation_risk") && camp.difficulty.parentSeparation > 0.65 ? "부모와 떨어지는 적응 부담이 클 수 있습니다." : "",
    budgetEstimateForRegion(profile, regionForCamp(camp))?.flags.includes("unknown_cost_assumption") ? "비용은 비교용 추정 단계라 상담 전 확인이 필요합니다." : "",
  ].filter((item) => item.length > 0)
}

export function buildMitigation(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    camp.beginnerClass ? "초급반 운영 방식과 실제 수업 난이도를 확인하세요." : "초급 영어 지원 가능 여부를 확인하세요.",
    camp.koreanManager ? "한국어 관리 범위와 연락 시간을 확인하세요." : "비상 시 한국어 소통 경로를 확인하세요.",
    parentAccompanimentMode(profile) === "parent_required" ? "부모 체류 일정과 아이 단독 참여 시간을 함께 확인하세요." : "초기 적응 보고 체계를 확인하세요.",
  ]
}

export function buildConsultingChecklist(camp: Camp, profile: ConsultingProfile): readonly string[] {
  return [
    "실제 포함/불포함 비용을 상담에서 확인하세요.",
    ...(budgetEstimateForRegion(profile, regionForCamp(camp))?.flags.includes("unknown_cost_assumption") ? ["항공권, 보험, 현지 이동비는 상담 전 확인 필요입니다."] : []),
    "숙소, 식사, 이동 관리 담당자를 확인하세요.",
  ]
}

export function childFitText(camp: Camp, profile: ConsultingProfile): string {
  return riskSignals(profile).includes("english_overload") && camp.beginnerClass
    ? "영어 초급 부담을 낮출 수 있는 장치가 있습니다."
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

function regionLabel(region: RegionGroup): string {
  switch (region) {
    case "southeast_asia":
      return "동남아"
    case "oceania":
      return "호주·뉴질랜드 등 오세아니아"
    case "north_america":
      return "북미"
    case "europe":
      return "유럽"
    case "domestic":
      return "국내 영어캠프"
    case "no_preference":
      return "지역 무관"
    case "undecided":
      return "아직 미정"
  }
}

function programTypeLabel(programType: Camp["programType"]): string {
  switch (programType) {
    case "managed_immersion":
      return "관리형 영어노출 캠프"
    case "schooling":
      return "스쿨링"
    case "family_esl":
      return "가족동반 ESL"
    case "activity":
      return "액티비티형"
    case "creative_daycamp":
      return "창의·데이캠프형"
    case "international_camp":
      return "국제캠프형"
  }
}

function tierLabel(tier: RecommendationTier): string {
  switch (tier) {
    case "best_fit":
      return "가장 적합"
    case "good_with_support":
      return "지원 조건 확인 후 적합"
    case "possible_if_adjusted":
      return "조건을 조정하면 검토 가능"
    case "not_recommended":
      return "지금은 우선순위가 낮음"
  }
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}
