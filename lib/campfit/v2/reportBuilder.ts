import type { CampfitV2MatchingResult, RecommendationCardV2WithScore } from "@/lib/campfit/v2/v2MatchingWrapper"
import {
  childAge,
  koreanSupportNeed,
  parentAccompanimentMode,
  preferredProgramTypes,
  preferredRegions,
  riskSignals,
  stringArrayValue,
} from "@/lib/campfit/v2/profileAccess"
import type { ConsultingProfile, ExcludedCandidateV2, ExcludedSummaryGroup, FitScoreSummary, RegionGroup, ReportOptionGroup } from "@/types/campfitV2"
import type { RecommendationReportV2 } from "@/types/campfitV2"

const fallbackFitScoreSummary: FitScoreSummary = {
  overallScore: 58,
  tier: "possible_if_adjusted",
  label: "조건을 조정하면 검토 가능",
  axes: [
    { key: "child_fit", label: "아이 적응 적합도", score: 62, comment: "아이 성향을 기준으로 지원 장치 확인이 필요합니다." },
    { key: "english_readiness", label: "영어 준비도 적합도", score: 58, comment: "영어 초급 부담은 상담 전 확인해야 합니다." },
    { key: "family_constraints", label: "부모 조건 적합도", score: 60, comment: "부모 동행과 현지 체류 조건을 함께 확인해야 합니다." },
    { key: "support_fit", label: "지원장치 적합도", score: 58, comment: "한국어 지원과 초기 적응 관리 범위를 확인해야 합니다." },
    { key: "growth_balance", label: "성장 자극 적합도", score: 64, comment: "문화 경험과 영어 노출을 균형 있게 보는 방향입니다." },
    { key: "budget_reality", label: "비용 현실성", score: 60, comment: "항공권 포함 총비용은 상담 전 확인 필요입니다." },
    { key: "risk_management", label: "리스크 관리", score: 56, comment: "조건 충돌을 줄이는 방향으로 좁혀야 합니다." },
  ],
}

export function buildCampfitV2Report(
  profile: ConsultingProfile,
  matchingResult: CampfitV2MatchingResult,
): RecommendationReportV2 {
  const reviewCandidates = candidatesForReview(matchingResult)
  const fitScoreSummary = buildReportFitScoreSummary(reviewCandidates)

  return {
    conclusion: buildConclusion(profile, reviewCandidates),
    fitScoreSummary,
    familySummary: buildFamilySummary(profile),
    childReadinessSummary: buildChildReadinessSummary(profile),
    recommendedProgramModes: buildRecommendedProgramModes(profile, matchingResult),
    optionGroups: buildOptionGroups(profile, matchingResult, reviewCandidates),
    recommendations: reviewCandidates,
    excludedCandidates: matchingResult.excludedCandidates,
    excludedSummaryGroups: buildExcludedSummaryGroups(matchingResult.excludedCandidates),
    conditionRelaxationSuggestions: buildConditionRelaxationSuggestions(profile, matchingResult),
    consultingChecklist: buildConsultingChecklist(profile, matchingResult),
  }
}

export function buildFamilySummary(profile: ConsultingProfile): string {
  const regions = preferredRegions(profile)
  const regionText = regions.length > 0 ? regions.map(regionLabel).join(", ") : "지역은 유연하게 검토"
  return `지금 가족 조건은 ${regionText}를 중심으로, 아이 만 ${childAge(profile)}세 기준 적응 난이도와 ${parentModeLabel(parentAccompanimentMode(profile))}, ${supportNeedLabel(koreanSupportNeed(profile))}를 함께 살펴봐야 합니다.`
}

export function buildChildReadinessSummary(profile: ConsultingProfile): string {
  const risks = riskSignals(profile)
  if (risks.includes("english_overload") && risks.includes("separation_risk")) {
    return "아이에게는 영어 노출 자체보다 낯선 환경과 부모 분리 적응 부담이 더 큰 변수로 보입니다."
  }

  if (risks.includes("english_overload") || risks.includes("english_proficiency_concern")) {
    return "영어 초급 부담이 있어 정규 스쿨링을 바로 선택하기보다 초급 지원과 낮은 압박 환경을 먼저 확인하는 편이 좋습니다."
  }

  return "현재 입력만으로는 아이 준비도를 단정하기보다, 캠프 난이도와 초기 적응 지원을 함께 비교하는 편이 적합합니다."
}

export function buildRecommendedProgramModes(
  profile: ConsultingProfile,
  matchingResult: CampfitV2MatchingResult,
): readonly string[] {
  const preferences = preferredProgramTypes(profile)
  if (matchingResult.recommendations.length === 0 && matchingResult.relaxedCandidates.length === 0) {
    return ["정확히 맞는 후보는 부족하지만, 조건을 조정해 가까운 선택지를 좁히는 방식"]
  }

  if (preferences.some((value) => value.includes("school"))) {
    return ["국제학교 분위기를 경험할 수 있는 방학캠프형", "초급 부담을 낮춘 부모동반 ESL + 액티비티형", "관리 장치가 있는 영어노출 캠프"]
  }

  return ["안정적인 첫 해외캠프형", "영어 거부감 완화 중심 프로그램", "문화 경험과 활동 균형형"]
}

export function buildAvoidProgramTypes(profile: ConsultingProfile): readonly string[] {
  const avoid = stringArrayValue(profile.riskProfile, "avoid_conditions")
  return avoid.map((item) => `피하고 싶은 조건: ${humanizeSignal(item)}`)
}

export function buildConditionRelaxationSuggestions(
  profile: ConsultingProfile,
  matchingResult: CampfitV2MatchingResult,
): readonly string[] {
  const suggestions = new Set<string>()
  for (const candidate of matchingResult.excludedCandidates) {
    candidate.conditionRelaxation.forEach((item) => suggestions.add(item))
  }

  if (matchingResult.recommendations.length === 0) {
    suggestions.add("정확히 맞는 후보는 부족하지만, 지역·기간·예산·지원 조건 중 하나를 조정하면 비교 후보를 만들 수 있습니다.")
  }

  if (preferredRegions(profile).includes("oceania")) {
    suggestions.add("오세아니아 스쿨링은 방향성은 맞지만, 비용과 영어 준비도 부담을 함께 확인해야 합니다.")
  }

  return [...suggestions]
}

export function buildConsultingChecklist(
  profile: ConsultingProfile,
  matchingResult: CampfitV2MatchingResult,
): readonly string[] {
  const hasCostUnknown = [...matchingResult.recommendations, ...matchingResult.relaxedCandidates].some((card) =>
    card.consultingChecklist.some((item) => item.includes("항공권")),
  )
  return [
    "캠프비, 항공권, 보험, 현지 이동비 포함 범위를 실제 견적으로 확인하세요.",
    "숙소와 생활 관리 담당자, 비상 연락 체계를 확인하세요.",
    koreanSupportNeed(profile) === "resident_korean_manager"
      ? "한국어 지원이 상주인지, 일일 소통인지, 비상 지원인지 구분해 확인하세요."
      : "한국어 지원이 필수 조건이 아니라면 비상 소통 경로를 확인하세요.",
    ...(hasCostUnknown ? ["비용 항목은 비교용 추정이므로 상담 전 최종 확인이 필요합니다."] : []),
  ]
}

function candidatesForReview(matchingResult: CampfitV2MatchingResult): readonly RecommendationCardV2WithScore[] {
  const exactOrConditional = matchingResult.recommendations.length > 0 ? matchingResult.recommendations : matchingResult.relaxedCandidates
  return exactOrConditional.slice(0, 3)
}

function buildReportFitScoreSummary(candidates: readonly RecommendationCardV2WithScore[]): FitScoreSummary {
  const first = candidates[0]
  if (first === undefined) return fallbackFitScoreSummary
  const averageScore = Math.max(58, Math.round(candidates.reduce((sum, card) => sum + card.fitScoreSummary.overallScore, 0) / candidates.length))
  return {
    ...first.fitScoreSummary,
    overallScore: averageScore,
    label: averageScore >= 80 ? "검토 우선순위 높음" : averageScore >= 65 ? "조건 확인 후 검토" : "조건 조정 중심 검토",
  }
}

function buildConclusion(profile: ConsultingProfile, candidates: readonly RecommendationCardV2WithScore[]): string {
  const regions = preferredRegions(profile)
  const wantsOceania = regions.includes("oceania")
  const hasCandidate = candidates.length > 0
  if (wantsOceania && riskSignals(profile).some((signal) => signal.includes("english"))) {
    return "지금 조건에서는 오세아니아 정규 스쿨링보다, 국제학교 분위기를 경험할 수 있는 방학캠프형이나 부모동반 ESL형부터 검토해보시길 권합니다."
  }

  if (!hasCandidate) {
    return "정확히 맞는 후보는 아직 없지만, 아래 방향을 기준으로 조건을 조정하면 가까운 후보를 비교해볼 수 있습니다."
  }

  return "현재 입력 기준으로는 아이 적응과 가족 관리 조건을 함께 만족시키는 후보부터 비교하는 것이 좋습니다."
}

function buildOptionGroups(
  profile: ConsultingProfile,
  matchingResult: CampfitV2MatchingResult,
  candidates: readonly RecommendationCardV2WithScore[],
): readonly ReportOptionGroup[] {
  const baseScore = Math.max(candidates[0]?.fitScoreSummary.overallScore ?? 62, 62)
  const wantsOceania = preferredRegions(profile).includes("oceania")
  const hasUnknownCost = profile.budgetEstimates.some((estimate) => estimate.flags.includes("unknown_cost_assumption"))
  return [
    {
      key: "keep_preferred_region",
      title: wantsOceania ? "오세아니아 국제학교 방학캠프 / 체험형" : "희망 지역을 유지하는 선택",
      fitLabel: "방향은 가장 가깝지만 조건 확인이 필요합니다.",
      score: Math.max(50, baseScore - 8),
      matchedPoints: ["부모님이 원한 지역과 경험 방향을 최대한 유지합니다.", "국제학교 분위기나 현지 학교 경험을 살릴 수 있습니다."],
      tradeoffs: ["영어 초급 아이에게 정규수업 부담이 있을 수 있습니다.", hasUnknownCost ? "항공권 포함 총비용은 상담 전 확인이 필요합니다." : "예산 범위가 좁아질 수 있습니다."],
      suggestedAction: "정규 스쿨링보다 방학캠프형 또는 체험형부터 실제 가능 여부를 확인하세요.",
    },
    {
      key: "prioritize_child_fit",
      title: "가족동반 ESL + 액티비티형",
      fitLabel: "첫 해외캠프라면 가장 안전한 시작점입니다.",
      score: Math.min(92, baseScore + 6),
      matchedPoints: ["부모 체류와 아이 초기 적응을 함께 관리할 수 있습니다.", "영어를 공부보다 생활 속 언어로 받아들이는 데 유리합니다."],
      tradeoffs: ["정규 스쿨링의 몰입감은 낮아질 수 있습니다.", "국제학교 수업 경험은 별도 옵션 확인이 필요합니다."],
      suggestedAction: "초급 영어 지원, 부모 체류 가능 숙소, 활동 비중을 먼저 비교하세요.",
    },
    {
      key: "prioritize_budget_and_support",
      title: "동남아 관리형 영어노출 캠프",
      fitLabel: "예산과 관리 안정성을 우선하면 현실성 높은 대안입니다.",
      score: matchingResult.relaxedCandidates.length > 0 ? Math.min(88, baseScore + 4) : Math.max(55, baseScore - 2),
      matchedPoints: ["한국어 지원과 생활 관리 조건을 맞추기 쉽습니다.", "총비용과 일정 조정 폭이 상대적으로 넓습니다."],
      tradeoffs: ["처음 원한 오세아니아 지역과는 달라질 수 있습니다.", "국제학교 분위기보다 관리형 영어노출에 가까울 수 있습니다."],
      suggestedAction: "지역 우선순위를 낮출 수 있다면 관리 안정성 높은 후보를 함께 비교하세요.",
    },
  ]
}

function buildExcludedSummaryGroups(candidates: readonly ExcludedCandidateV2[]): readonly ExcludedSummaryGroup[] {
  const groups = [
    { key: "budget", label: "예산/총비용 조건 때문에 제외된 후보", count: countByReason(candidates, "예산") },
    { key: "duration", label: "기간 조건 때문에 제외된 후보", count: countByReason(candidates, "기간") },
    { key: "korean_support", label: "한국어 지원 조건 때문에 제외된 후보", count: countByReason(candidates, "한국어") },
    { key: "parent", label: "부모 동행 조건 때문에 제외된 후보", count: countByReason(candidates, "부모") },
    { key: "region", label: "지역 필수 조건 때문에 제외된 후보", count: countByReason(candidates, "지역") },
  ] as const
  return groups.filter((group) => group.count > 0)
}

function countByReason(candidates: readonly ExcludedCandidateV2[], keyword: string): number {
  return candidates.filter((candidate) => candidate.excludedReasons.some((reason) => reason.includes(keyword))).length
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

function parentModeLabel(value: string): string {
  switch (value) {
    case "parent_required":
      return "부모 동행 필수"
    case "parent_can_stay":
      return "부모가 현지에 머무를 수 있음"
    case "departure_arrival_only":
      return "출국·입국 동행 가능"
    case "child_solo_or_chaperone_ok":
      return "아이 단독 또는 인솔자 동행 가능"
    default:
      return "부모 동행 방식 미정"
  }
}

function supportNeedLabel(value: string): string {
  switch (value) {
    case "resident_korean_manager":
      return "한국인 관리자 상주 필요"
    case "daily_korean_communication":
      return "매일 한국어 소통 필요"
    case "emergency_only":
      return "비상 시 한국어 지원 필요"
    case "not_needed":
      return "한국어 지원 필수 아님"
    default:
      return "한국어 지원 수준 미정"
  }
}

function humanizeSignal(value: string): string {
  return value.replaceAll("_", " ")
}
