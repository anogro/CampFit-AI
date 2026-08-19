import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3DestinationRecommendation,
  CampfitV3ProgramCandidate,
  CampfitV3RecommendationResult,
} from "@/types/campfitV3"
import { englishMatchLabels } from "@/lib/campfit/v3/englishRequirement"

export function cityWhyBullets(
  city: CampfitV3DestinationRecommendation,
  basicInfo: CampfitV3BasicInfo,
  state: CampfitV3ConversationState,
  result: CampfitV3RecommendationResult,
): readonly string[] {
  const primary = result.experienceDirections[0]?.label
  const stayGoal = stayGoalLabel(state)
  const costFit = cityCostFit(city)
  const roleReason = city.role === "가장 균형 잡힌 선택"
    ? "아이와 부모의 조건을 가장 균형 있게 반영했어요."
    : city.role === "원래 희망을 가장 잘 살리는 선택"
      ? "원하는 경험 방향을 살리면서 함께 비교할 수 있어요."
      : "비용과 부모 체류 조건을 함께 조정할 수 있는 대안이에요."
  return unique([
    roleReason,
    `${basicInfo.durationWeeks}주 가족 체류를 기준으로 비교했어요.`,
    primary ? `${primary.replace(/ 경험$/, "")} 방향을 중심으로 살펴봤어요.` : "아이의 경험과 생활 조건을 함께 살펴봤어요.",
    stayGoal ? `${stayGoal}도 고려해 부모 체류 환경을 함께 봤어요.` : "부모가 머무를 생활환경도 함께 봤어요.",
    costFit,
  ]).slice(0, 5)
}

export function cityCheckItems(city: CampfitV3DestinationRecommendation): readonly string[] {
  return unique(city.verify.map(shortenCheckItem).filter(Boolean)).slice(0, 4)
}

export function cityCostDetails(city: CampfitV3DestinationRecommendation): {
  readonly included: readonly string[]
  readonly missing: readonly string[]
} {
  return {
    included: city.costEstimate.includedComponents.map(shortenCostItem),
    missing: city.costEstimate.missingComponents.map(shortenCostItem),
  }
}

export function programReason(program: CampfitV3ProgramCandidate): string {
  return program.reason.trim()
}

export function programRecommendationReasons(programs: readonly CampfitV3ProgramCandidate[]): readonly string[] {
  const used = new Set<string>()
  return programs.map((program) => {
    const primary = programReason(program)
    if (!used.has(primary)) {
      used.add(primary)
      return primary
    }
    const alternative = (program.matchHighlights ?? []).find((highlight) => highlight.trim().length > 0 && !used.has(highlight.trim()))
    if (alternative) {
      const normalized = alternative.trim()
      used.add(normalized)
      return normalized
    }
    used.add(primary)
    return primary
  })
}

export function programStrengths(program: CampfitV3ProgramCandidate, reasonOverride?: string): readonly string[] {
  const primary = reasonOverride?.trim() || programReason(program)
  const matchHighlights = program.matchHighlights ?? []
  const strengths: string[] = [primary, ...matchHighlights]
  if (matchHighlights.length === 0 && program.ageLabel !== "연령 확인 필요") strengths.push("아이 연령에 맞는 범위를 확인했어요.")
  if (matchHighlights.length === 0 && program.durationLabel !== "기간 확인 필요") strengths.push(`${program.durationLabel} 선택지를 확인했어요.`)
  return unique(strengths).slice(0, 3)
}

export function programCautions(program: CampfitV3ProgramCandidate): readonly string[] {
  const englishCaution = englishCautionFor(program)
  const verification = program.englishMatchStatus === "official_requirement_mismatch"
    ? program.verify.filter((item) => !/공식 영어|영어 자격조건/i.test(item))
    : program.verify
  const cautions = [englishCaution, program.tradeoff, ...verification.map(shortenCheckItem)].filter((value): value is string => Boolean(value?.trim()))
  return cautions.length ? unique(cautions).slice(0, 3) : ["신청 전 최신 일정과 가격만 한 번 더 확인해 주세요."]
}

export function rankLabel(index: number): string {
  return index === 0 ? "Best Match" : "Alternative Recommendation"
}

function englishCautionFor(program: CampfitV3ProgramCandidate): string | null {
  if (program.englishMatchStatus === "comfortable" || program.englishMatchStatus === "official_requirement_mismatch") return null
  if (program.englishMatchStatus === "english_burden_possible") return englishMatchLabels.english_burden_possible
  if (program.englishMatchStatus === "unknown") return "프로그램 영어 요구 수준 확인 필요"
  if (program.englishMatchStatus === "manageable_with_support") {
    const hasSupportEvidence = program.verify.some((item) => /영어|초급자|지원|적응|수업 방식/i.test(item))
      || Boolean(program.tradeoff?.trim())
    return hasSupportEvidence ? "영어 수업 방식과 초반 지원 범위 확인" : null
  }
  return null
}

function cityCostFit(city: CampfitV3DestinationRecommendation): string {
  if (city.livingCostMonthlyKrw !== null) return "도시 평균 생활비와 부모 체류 조건을 함께 살펴봤어요."
  return "도시 평균 생활비는 최신 정보 확인이 필요해요."
}

function stayGoalLabel(state: CampfitV3ConversationState): string | null {
  const goals = state.facts.parentStayGoals?.value
  if (!Array.isArray(goals)) return null
  if (goals.includes("restWellness")) return "휴식·웰니스"
  if (goals.includes("remoteWork")) return "원격근무"
  if (goals.includes("cafeDining")) return "현지 생활·카페"
  if (goals.includes("tourismCulture")) return "관광·문화"
  if (goals.includes("natureBeach")) return "자연·해변"
  if (goals.includes("childScheduleFirst")) return "아이 일정"
  return null
}

function shortenCheckItem(value: string): string {
  if (value.includes("이동시간")) return "숙소에서 프로그램까지 이동시간"
  if (value.includes("항공")) return "항공권 시기와 가족 기준 요금"
  if (value.includes("숙소") || value.includes("주거")) return "숙소 유형과 실제 단기 요금"
  if (value.includes("인터넷") || value.includes("원격근무")) return "인터넷·업무공간 등 부모 생활환경"
  if (value.includes("가격") || value.includes("비용")) return "프로그램·숙소를 포함한 실제 총비용"
  if (value.includes("응급") || value.includes("병원")) return "응급 상황 대응 범위"
  if (value.includes("최신") || value.includes("운영")) return "최신 운영 일정"
  if (value.includes("핵심 경험 방향")) return "원하는 경험 방향과 실제 활동의 차이"
  if (value.includes("구조화 근거")) return "프로그램의 실제 활동 구성"
  if (value.includes("부모가 같은 도시")) return "부모가 머물 숙소와 프로그램 위치"
  if (value.includes("세션")) return "희망 기간에 운영되는 세션"
  return value
}

function shortenCostItem(value: string): string {
  if (value.includes("항공")) return "항공권 참고값"
  if (value.includes("주거") || value.includes("숙소")) return "주거비 참고값"
  if (value.includes("생활")) return "생활비 참고값"
  if (value.includes("프로그램")) return "프로그램비 참고값"
  if (value.includes("교통")) return "현지 교통비"
  if (value.includes("보험") || value.includes("비자")) return "보험·비자"
  return value
}

function unique(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}
