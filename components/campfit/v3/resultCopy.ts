import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3DestinationRecommendation,
  CampfitV3ProgramCandidate,
  CampfitV3RecommendationResult,
} from "@/types/campfitV3"

export function cityWhyBullets(
  city: CampfitV3DestinationRecommendation,
  basicInfo: CampfitV3BasicInfo,
  state: CampfitV3ConversationState,
  result: CampfitV3RecommendationResult,
): readonly string[] {
  const primary = result.experienceDirections[0]?.label
  const stayGoal = stayGoalLabel(state)
  const costFit = cityCostFit(city, basicInfo)
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
  if (program.reason.includes("대안으로만") || program.group === "함께 비교할 대안") return "원하는 방향과는 조금 다르지만, 이런 점이 괜찮다면 충분히 고려할 수 있는 선택지예요."
  return `${directionObjectPhrase(friendlyDirectionLabel(program.primaryDirection))} 중심으로 아이의 조건을 살펴볼 수 있어요.`
}

export function programStrengths(program: CampfitV3ProgramCandidate): readonly string[] {
  const strengths: string[] = [programReason(program)]
  if (program.ageLabel !== "연령 확인 필요") strengths.push("아이 연령에 맞는 범위를 확인했어요.")
  if (program.durationLabel !== "기간 확인 필요") strengths.push(`${program.durationLabel} 선택지를 확인했어요.`)
  return unique(strengths).slice(0, 3)
}

export function programCautions(program: CampfitV3ProgramCandidate): readonly string[] {
  const cautions = program.verify.map(shortenCheckItem).filter(Boolean)
  return cautions.length ? unique(cautions).slice(0, 3) : ["신청 전 최신 일정과 가격만 한 번 더 확인해 주세요."]
}

export function rankLabel(index: number): string {
  return index === 0 ? "Best Match" : "Alternative Recommendation"
}

function cityCostFit(city: CampfitV3DestinationRecommendation, basicInfo: CampfitV3BasicInfo): string {
  const max = city.costEstimate.estimatedTotalMaxKrw
  const min = city.costEstimate.estimatedTotalMinKrw
  if (max !== null && max <= basicInfo.budgetMaxKrw) return "입력한 전체 예산 안에서 비교 가능한 구간이 있어요."
  if (min !== null && min <= basicInfo.budgetMaxKrw) return "예산 안에서 시작할 수 있는 비용 구간이 있어요."
  return "총비용은 항공·숙소 조건까지 함께 확인해야 해요."
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

function friendlyDirectionLabel(value: string): string {
  if (value === "schoolSchooling") return "학교·스쿨링"
  if (value === "englishIntensive") return "영어 집중"
  if (value === "subjectProject") return "주제·프로젝트"
  if (value === "cultureActivity") return "문화·활동"
  return value.replace(/ 경험$/, "")
}

function directionObjectPhrase(value: string): string {
  if (value === "주제·프로젝트") return `${value}를`
  return `${value}을`
}

function unique(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}
