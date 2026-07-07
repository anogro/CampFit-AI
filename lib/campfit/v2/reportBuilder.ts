import type { CampfitV2MatchingResult } from "@/lib/campfit/v2/v2MatchingWrapper"
import {
  childAge,
  koreanSupportNeed,
  parentAccompanimentMode,
  preferredProgramTypes,
  preferredRegions,
  riskSignals,
  stringArrayValue,
} from "@/lib/campfit/v2/profileAccess"
import type { ConsultingProfile, RecommendationReportV2 } from "@/types/campfitV2"

export function buildCampfitV2Report(
  profile: ConsultingProfile,
  matchingResult: CampfitV2MatchingResult,
): RecommendationReportV2 {
  return {
    familySummary: buildFamilySummary(profile),
    childReadinessSummary: buildChildReadinessSummary(profile),
    recommendedProgramModes: buildRecommendedProgramModes(profile, matchingResult),
    recommendations: matchingResult.recommendations,
    excludedCandidates: matchingResult.excludedCandidates,
    conditionRelaxationSuggestions: buildConditionRelaxationSuggestions(profile, matchingResult),
    consultingChecklist: buildConsultingChecklist(profile, matchingResult),
  }
}

export function buildFamilySummary(profile: ConsultingProfile): string {
  const regions = preferredRegions(profile)
  const regionText = regions.length > 0 ? regions.join(", ") : "열린 지역"
  const parentMode = parentAccompanimentMode(profile)
  const supportNeed = koreanSupportNeed(profile)
  return `현재 가족 조건은 ${regionText} 중심의 상담형 비교에 가깝습니다. 아이 만 ${childAge(profile)}세 기준으로 부모 동행 조건은 ${parentMode}, 한국어 지원 조건은 ${supportNeed}입니다.`
}

export function buildChildReadinessSummary(profile: ConsultingProfile): string {
  const risks = riskSignals(profile)
  if (risks.includes("english_overload") && risks.includes("separation_risk")) {
    return "아이는 영어 노출 자체보다 낯선 환경과 부모 분리 적응 부담이 더 큰 변수로 보입니다."
  }

  if (risks.includes("english_overload")) {
    return "영어 준비도 부담이 있어 초급 지원, 도움 요청 경로, 낮은 압박의 말하기 환경을 확인해야 합니다."
  }

  return "현재 입력만으로는 아이 준비도를 단정하지 않고, 캠프 난이도와 완충장치를 함께 비교하는 편이 적합합니다."
}

export function buildRecommendedProgramModes(
  profile: ConsultingProfile,
  matchingResult: CampfitV2MatchingResult,
): readonly string[] {
  const preferences = preferredProgramTypes(profile)
  if (matchingResult.recommendations.length === 0) {
    return ["추천 없음 / 조건 조정 필요"]
  }

  if (preferences.some((value) => value.includes("school"))) {
    return ["국제학교 방학캠프 또는 관리형 스쿨링", "영어 부담을 낮춘 액티비티 혼합형"]
  }

  return ["안정형 첫 해외캠프", "영어 거부감 완화 중심 프로그램"]
}

export function buildAvoidProgramTypes(profile: ConsultingProfile): readonly string[] {
  const avoid = stringArrayValue(profile.riskProfile, "avoid_conditions")
  return avoid.map((item) => `피하고 싶은 조건: ${item}`)
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
    suggestions.add("정확히 맞는 후보가 부족하므로 지역, 기간, 예산, 한국어 지원 조건 중 하나를 조정해야 합니다.")
  }

  if (preferredRegions(profile).includes("oceania")) {
    suggestions.add("오세아니아 스쿨링형은 항공권 포함 총예산과 기간 조건을 함께 보면 조건 조정이 필요할 수 있습니다.")
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
    "캠프비, 항공권, 보험, 현지 이동비 포함 여부를 비교용 추정이 아닌 실제 견적으로 확인하세요.",
    "숙소와 생활 관리 담당자, 비상 연락 체계를 확인하세요.",
    koreanSupportNeed(profile) === "resident_korean_manager"
      ? "한국어 지원이 상주인지, 일일 소통인지, 비상 지원인지 구분해 확인하세요."
      : "한국어 지원이 필수는 아니더라도 비상시 소통 경로를 확인하세요.",
    ...(hasCostUnknown ? ["비용 관련 항목은 상담 전 확인 필요로 표시된 후보를 우선 확인하세요."] : []),
  ]
}
