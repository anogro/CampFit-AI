import type { V3Catalog, V3CatalogCity, V3CatalogProgram, V3PriceOption } from "@/lib/campfit/v3/catalogRepository"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3CostEstimate,
  CampfitV3DestinationRecommendation,
  CampfitV3ExperienceDirection,
  CampfitV3ProgramCandidate,
  CampfitV3RecommendationResult,
  ExperienceDirectionKey,
  ExperienceGoalStrength,
} from "@/types/campfitV3"

const directionLabels: Readonly<Record<ExperienceDirectionKey, string>> = {
  schoolSchooling: "학교·스쿨링 경험",
  englishIntensive: "영어 집중 경험",
  subjectProject: "주제·프로젝트 경험",
  cultureActivity: "문화·활동 경험",
}

type ScoredProgram = {
  readonly program: V3CatalogProgram
  readonly score: number
  readonly direction: ExperienceDirectionKey
  readonly conditional: boolean
  readonly verify: readonly string[]
}

export function buildRecommendation(input: {
  readonly basicInfo: CampfitV3BasicInfo
  readonly state: CampfitV3ConversationState
  readonly catalog: V3Catalog
}): CampfitV3RecommendationResult {
  const directions = scoreExperienceDirections(input.state)
  const scoredPrograms = scorePrograms(input.basicInfo, input.state, input.catalog.programs, directions)
  const destinations = scoreDestinations(input.basicInfo, input.state, input.catalog.cities, scoredPrograms)
  const selectedCityNames = new Set(destinations.map((destination) => normalize(destination.cityName)))
  const programCandidates = scoredPrograms
    .filter((item) => selectedCityNames.size === 0 || selectedCityNames.has(normalize(item.program.city)))
    .slice(0, 3)
    .map((item) => toProgramCandidate(item, input.basicInfo))
  const requiredSupportConditions = supportConditions(input.state)
  const missingRequired = requiredFactLabels(input.state)
  const limitedResult = missingRequired.length > 0 || destinations.length < 2 || programCandidates.length < 2
  const primaryDirection = directions[0]

  return {
    consultingConclusion: primaryDirection
      ? `현재 조건에서는 ${primaryDirection.label}을 중심으로 살펴보는 편이 좋습니다. 부모님이 같은 도시에 머무는 낮 프로그램 중에서 필요한 지원과 비용 확인이 가능한 후보부터 비교해보세요.`
      : "현재 확인한 조건을 기준으로 부모동반형 낮 프로그램을 살펴볼 수 있습니다. 부족한 정보는 상담 전 확인사항으로 남겼어요.",
    experienceDirections: directions,
    destinationRecommendations: destinations,
    requiredSupportConditions,
    programCandidates,
    verificationChecklist: Array.from(new Set([
      ...requiredSupportConditions,
      "숙소와 프로그램 사이의 실제 이동시간",
      "최신 프로그램 가격과 포함·불포함 항목",
      "항공편과 단기 숙소의 실제 견적",
      ...missingRequired,
    ])),
    alternatives: buildAlternatives(directions, scoredPrograms, missingRequired),
    limitedResult,
  }
}

export function scoreExperienceDirections(state: CampfitV3ConversationState): readonly CampfitV3ExperienceDirection[] {
  const goals = readGoalStrengths(state)
  const readiness = englishReadiness(state)
  const studyOnlyAvoidance = state.facts.studyOnlyAvoidance?.value === true
  const scores: Record<ExperienceDirectionKey, number> = {
    schoolSchooling: strengthScore(goals.schoolSchooling) * 0.7 + formatFit("schoolSchooling", readiness) * 0.3 - (studyOnlyAvoidance ? 12 : 0),
    englishIntensive: strengthScore(goals.englishIntensive) * 0.7 + formatFit("englishIntensive", readiness) * 0.3 - (studyOnlyAvoidance ? 8 : 0),
    subjectProject: strengthScore(goals.subjectProject) * 0.7 + formatFit("subjectProject", readiness) * 0.3,
    cultureActivity: strengthScore(goals.cultureActivity) * 0.7 + formatFit("cultureActivity", readiness) * 0.3 + (studyOnlyAvoidance ? 8 : 0),
  }
  return (Object.entries(scores) as readonly [ExperienceDirectionKey, number][])
    .map(([key, value]) => ({ key, score: clamp(value) }))
    .sort((left, right) => right.score - left.score)
    .map((item, index): CampfitV3ExperienceDirection => ({
      key: item.key,
      label: directionLabels[item.key],
      fitLabel: index === 0 ? "가장 잘 맞는 방향" : index === 1 ? "함께 검토할 방향" : item.score >= 50 ? "조건을 조정하면 가능" : "현재 우선순위가 낮음",
      score: item.score,
      explanation: directionExplanation(item.key, readiness),
    }))
}

function scorePrograms(
  basicInfo: CampfitV3BasicInfo,
  state: CampfitV3ConversationState,
  programs: readonly V3CatalogProgram[],
  directions: readonly CampfitV3ExperienceDirection[],
): readonly ScoredProgram[] {
  const directionScore = new Map(directions.map((direction) => [direction.key, direction.score]))
  const koreanNeed = String(state.facts.koreanSupportNeed?.value ?? "unknown")
  const care = String(state.facts.specialCareFollowUp?.value ?? "unknown")
  const communication = String(state.facts.parentCommunicationNeed?.value ?? "unknown")

  return programs.flatMap((program): readonly ScoredProgram[] => {
    if (!program.parentAccompanied) return []
    if (basicInfo.childAges.some((age) => age < program.ageMin || age > program.ageMax)) return []
    if (program.durationWeeks.length > 0 && !program.durationWeeks.includes(basicInfo.durationWeeks)) return []
    if (koreanNeed === "must_daily" && program.koreanManager === false) return []

    const direction = programDirection(program)
    const goalFit = directionScore.get(direction) ?? 50
    const beginnerFit = String(state.facts.childEnglishLevel?.value ?? "unknown") === "beginner"
      ? program.beginnerClass === true ? 100 : program.beginnerClass === false ? 35 : 60
      : 75
    const supportFit = koreanNeed === "must_daily" || koreanNeed === "emergency_only"
      ? program.koreanManager === true ? 100 : 55
      : 80
    const budgetFit = program.budgetMinKrw === null ? 60 : program.budgetMinKrw <= basicInfo.budgetMaxKrw ? 90 : 45
    const score = clamp(goalFit * 0.45 + beginnerFit * 0.2 + supportFit * 0.25 + budgetFit * 0.1)
    const verify: string[] = []
    if (program.koreanManager === null && koreanNeed !== "none") verify.push("한국어 지원 범위와 대응 시간")
    if (program.beginnerClass === null) verify.push("영어 초급자 반·초기 적응 지원")
    if (communication === "daily" && program.dailyParentReport !== true) verify.push("부모에게 전달되는 활동 소식의 빈도")
    if (care === "required" || care === "unknown") verify.push("특별 식사·복약·건강·생활 지원 조건")
    if (!program.priceOptions.length && program.budgetMinKrw === null) verify.push("프로그램 가격과 포함 항목")
    return [{ program, score, direction, conditional: verify.length > 0, verify }]
  }).sort((left, right) => right.score - left.score)
}

function scoreDestinations(
  basicInfo: CampfitV3BasicInfo,
  state: CampfitV3ConversationState,
  cities: readonly V3CatalogCity[],
  programs: readonly ScoredProgram[],
): readonly CampfitV3DestinationRecommendation[] {
  const preferred = Array.isArray(state.facts.preferredRegions?.value) ? state.facts.preferredRegions.value.map(String) : []
  const importance = String(state.facts.regionImportance?.value ?? "no_preference")
  const stayGoals = Array.isArray(state.facts.parentStayGoals?.value) ? state.facts.parentStayGoals.value.map(String) : []
  const scored = cities.flatMap((city) => {
    const cityPrograms = programs.filter((item) => normalize(item.program.city) === normalize(city.name))
    if (!cityPrograms.length) return []
    if (importance === "must" && preferred.length && !preferred.includes(city.regionGroup)) return []
    const supply = Math.min(100, 45 + cityPrograms.length * 12)
    const programFit = cityPrograms.slice(0, 3).reduce((sum, item) => sum + item.score, 0) / Math.min(3, cityPrograms.length)
    const regionFit = !preferred.length ? 70 : preferred.includes(city.regionGroup) ? 100 : importance === "strong" ? 35 : 60
    const costFit = cityBudgetFit(city, cityPrograms[0]?.program ?? null, basicInfo)
    const parentFit = stayGoals.includes("childScheduleFirst") ? 70 : city.description ? 78 : 60
    return [{ city, cityPrograms, balance: regionFit * 0.15 + supply * 0.2 + programFit * 0.35 + costFit * 0.15 + parentFit * 0.15, preference: regionFit * 0.5 + programFit * 0.5, alternative: costFit * 0.6 + parentFit * 0.4 }]
  })
  const selected: typeof scored = []
  takeUnique(selected, [...scored].sort((a, b) => b.balance - a.balance)[0])
  takeUnique(selected, [...scored].sort((a, b) => b.preference - a.preference).find((item) => !selected.some((chosen) => chosen.city.id === item.city.id)))
  takeUnique(selected, [...scored].sort((a, b) => b.alternative - a.alternative).find((item) => !selected.some((chosen) => chosen.city.id === item.city.id)))
  const roles: readonly CampfitV3DestinationRecommendation["role"][] = ["가장 균형 잡힌 선택", "원래 희망을 가장 잘 살리는 선택", "비용·부모 체류 관점의 대안"]
  return selected.map((item, index): CampfitV3DestinationRecommendation => ({
    cityId: item.city.id,
    cityName: item.city.name,
    countryName: item.city.country,
    role: roles[index] ?? "가장 균형 잡힌 선택",
    imageUrl: item.city.imageUrl,
    reason: cityReason(item.city, item.cityPrograms.length, preferred.includes(item.city.regionGroup)),
    verify: cityVerify(item.city),
    costEstimate: estimateCityCost(item.city, item.cityPrograms[0]?.program ?? null, basicInfo),
  }))
}

function toProgramCandidate(item: ScoredProgram, basicInfo: CampfitV3BasicInfo): CampfitV3ProgramCandidate {
  const exactPrice = selectPrice(item.program.priceOptions, basicInfo)
  const priceLabel = exactPrice?.priceValue !== null && exactPrice?.priceValue !== undefined && exactPrice.priceValue > 0
    ? `${formatNumber(exactPrice.priceValue)} ${exactPrice.currency ?? "통화 미확인"}`
    : item.program.budgetMinKrw !== null && item.program.budgetMinKrw > 0
      ? `${formatNumber(item.program.budgetMinKrw)}원부터 · 비교용`
      : "가격 확인 필요"
  const group: CampfitV3ProgramCandidate["group"] = item.conditional
    ? "조건 확인 후 살펴볼 프로그램"
    : item.score >= 75 ? "우선 살펴볼 프로그램" : "함께 비교할 대안"
  const baseUrl = process.env["NEXT_PUBLIC_ANOGRO_SITE_URL"] ?? "https://www.anogro.com"
  return {
    programId: item.program.id,
    name: item.program.name,
    cityName: item.program.city,
    countryName: item.program.country,
    imageUrl: item.program.imageUrl,
    ageLabel: `만 ${item.program.ageMin}~${item.program.ageMax}세`,
    durationLabel: item.program.durationWeeks.length ? `${item.program.durationWeeks.join("·")}주 옵션` : "기간 확인 필요",
    priceLabel,
    primaryDirection: directionLabels[item.direction],
    reason: `${directionLabels[item.direction]}과 현재 아이 나이·체류기간 조건을 함께 비교할 수 있는 실제 DB 후보입니다.`,
    verify: item.verify.length ? item.verify : ["최신 일정과 실제 수업 구성"],
    detailUrl: item.program.slug ? `${baseUrl}/program/${encodeURIComponent(item.program.slug)}` : null,
    group,
    score: item.score,
  }
}

function estimateCityCost(city: V3CatalogCity, program: V3CatalogProgram | null, basicInfo: CampfitV3BasicInfo): CampfitV3CostEstimate {
  const days = basicInfo.durationWeeks * 7
  const components: number[] = []
  const included: string[] = []
  const missing: string[] = []
  const exactPrice = program ? selectPrice(program.priceOptions, basicInfo) : null
  if (exactPrice?.currency === "KRW" && exactPrice.priceValue !== null && exactPrice.priceValue > 0) {
    components.push(exactPrice.priceValue)
    included.push("프로그램비")
  } else if (program?.budgetMinKrw !== null && program?.budgetMinKrw !== undefined && program.budgetMinKrw > 0) {
    components.push(program.budgetMinKrw)
    included.push("프로그램비 참고값")
  } else missing.push("프로그램비")
  if (city.flightCostKrw !== null) {
    components.push(city.flightCostKrw)
    included.push("항공비 참고값")
    missing.push("가족 항공권 실제 견적")
  } else missing.push("항공비")
  if (city.housingCostMonthlyKrw !== null) {
    components.push(city.housingCostMonthlyKrw * days / 30)
    included.push("주거비 참고값")
  } else missing.push("주거비")
  if (city.livingCostMonthlyKrw !== null) {
    components.push(city.livingCostMonthlyKrw * days / 30)
    included.push("생활비 참고값")
  } else missing.push("생활비")
  missing.push("현지 교통비", "보험·비자")
  const total = components.length ? Math.round(components.reduce((sum, value) => sum + value, 0)) : null
  return {
    estimatedTotalMinKrw: total,
    estimatedTotalMaxKrw: total === null ? null : Math.round(total * 1.18),
    includedComponents: included,
    missingComponents: missing,
    confidence: missing.length > 3 ? "low" : exactPrice?.currency === "KRW" ? "medium" : "low",
    label: "비교용 추정",
  }
}

function supportConditions(state: CampfitV3ConversationState): readonly string[] {
  const items: string[] = []
  const korean = String(state.facts.koreanSupportNeed?.value ?? "unknown")
  if (korean === "must_daily") items.push("매일 한국어 지원 가능 여부")
  if (korean === "emergency_only" || korean === "preferred") items.push("비상 시 한국어 대응")
  const communication = String(state.facts.parentCommunicationNeed?.value ?? "unknown")
  if (communication === "daily") items.push("부모에게 매일 간단한 활동 공유")
  if (communication === "issue_only") items.push("문제 발생 시 부모에게 즉시 연락")
  if (String(state.facts.childEnglishLevel?.value ?? "") === "beginner") items.push("영어 초급자 적응 지원")
  const care = String(state.facts.specialCareFollowUp?.value ?? "unknown")
  if (care !== "none") items.push("특별 식사 대응 확인", "복약 지원 확인", "건강·생활 지원 조건 확인")
  return items.length ? items : ["프로그램별 응급 연락 절차 확인"]
}

function requiredFactLabels(state: CampfitV3ConversationState): readonly string[] {
  const pairs = [
    ["childEnglishLevel", "아이 영어 수준 확인"], ["experienceGoals", "주요 경험 목표 확인"], ["preferredRegions", "희망 지역 확인"],
    ["regionImportance", "지역 중요도 확인"], ["koreanSupportNeed", "한국어 지원 수준 확인"], ["parentCommunicationNeed", "부모 연락 기준 확인"],
    ["parentStayGoals", "부모 체류 목적 확인"], ["specialCareFollowUp", "특별관리 후속 확인 여부"],
  ] as const
  return pairs.filter(([key]) => state.facts[key] === undefined).map(([, label]) => label)
}

function readGoalStrengths(state: CampfitV3ConversationState): Readonly<Record<ExperienceDirectionKey, ExperienceGoalStrength>> {
  const value = state.facts.experienceGoals?.value
  const record = typeof value === "object" && value !== null ? value as Partial<Record<ExperienceDirectionKey, ExperienceGoalStrength>> : {}
  return {
    schoolSchooling: record.schoolSchooling ?? "none",
    englishIntensive: record.englishIntensive ?? "none",
    subjectProject: record.subjectProject ?? "none",
    cultureActivity: record.cultureActivity ?? "none",
  }
}

function programDirection(program: V3CatalogProgram): ExperienceDirectionKey {
  if (program.programType === "schooling") return "schoolSchooling"
  if (program.programType === "managed_immersion" || program.programType === "family_esl") return "englishIntensive"
  if (program.programType === "creative_daycamp") return "subjectProject"
  return "cultureActivity"
}

function englishReadiness(state: CampfitV3ConversationState): number {
  const value = String(state.facts.childEnglishLevel?.value ?? "unknown")
  return value === "advanced" ? 90 : value === "intermediate" ? 72 : value === "basic" ? 48 : value === "beginner" ? 32 : 50
}

function strengthScore(value: ExperienceGoalStrength): number {
  return value === "primary" ? 100 : value === "secondary" ? 72 : value === "mentioned" ? 42 : 20
}

function formatFit(direction: ExperienceDirectionKey, readiness: number): number {
  if (direction === "schoolSchooling") return readiness >= 70 ? 90 : readiness >= 45 ? 70 : 55
  if (direction === "englishIntensive") return readiness >= 45 ? 85 : 68
  if (direction === "subjectProject") return readiness >= 45 ? 88 : 72
  return readiness < 70 ? 92 : 82
}

function directionExplanation(direction: ExperienceDirectionKey, readiness: number): string {
  if (direction === "schoolSchooling" && readiness < 50) return "학교 분위기는 살리되 정규수업보다 활동형 방학 프로그램부터 비교하는 편이 현실적입니다."
  if (direction === "englishIntensive") return "아이의 현재 수준에 맞는 분반과 초반 적응 지원 여부를 함께 확인해야 합니다."
  if (direction === "subjectProject") return "관심 분야 활동 속에서 영어를 사용하며 결과물을 만드는 프로그램을 살펴봅니다."
  return "학업 부담을 낮추고 활동과 문화 경험 속에서 자연스럽게 적응하는 방향입니다."
}

function cityReason(city: V3CatalogCity, programCount: number, preferred: boolean): string {
  const parts = [`현재 조건을 통과한 부모동반형 프로그램 ${programCount}개를 비교할 수 있습니다.`]
  if (preferred) parts.push("사용자가 선택한 지역 선호와도 일치합니다.")
  if (city.description) parts.push("도시 설명 데이터가 있어 체류 조건을 추가 비교할 수 있습니다.")
  return parts.join(" ")
}

function cityVerify(city: V3CatalogCity): readonly string[] {
  const items = ["프로그램과 숙소 사이 실제 이동시간"]
  if (city.flightCostKrw === null) items.push("항공료")
  else items.push("항공료의 왕복·출발지·시즌 기준")
  if (city.housingCostMonthlyKrw === null) items.push("단기 가족 숙소 가격")
  else items.push("도심 1BR 월 비용과 실제 단기 가족 숙소의 차이")
  return items
}

function selectPrice(options: readonly V3PriceOption[], basicInfo: CampfitV3BasicInfo): V3PriceOption | null {
  return options.find((option) => option.adultCount === basicInfo.adultCount && option.childCount === basicInfo.childCount && option.durationWeeks === basicInfo.durationWeeks)
    ?? options.find((option) => option.durationWeeks === basicInfo.durationWeeks && option.childCount === basicInfo.childCount)
    ?? null
}

function cityBudgetFit(city: V3CatalogCity, program: V3CatalogProgram | null, basicInfo: CampfitV3BasicInfo): number {
  const days = basicInfo.durationWeeks * 7
  const known: number[] = []
  if (city.flightCostKrw !== null && city.flightCostKrw > 0) known.push(city.flightCostKrw)
  if (city.livingCostMonthlyKrw !== null && city.livingCostMonthlyKrw > 0) known.push(city.livingCostMonthlyKrw * days / 30)
  if (city.housingCostMonthlyKrw !== null && city.housingCostMonthlyKrw > 0) known.push(city.housingCostMonthlyKrw * days / 30)
  const exactPrice = program ? selectPrice(program.priceOptions, basicInfo) : null
  if (exactPrice?.currency === "KRW" && exactPrice.priceValue !== null && exactPrice.priceValue > 0) known.push(exactPrice.priceValue)
  else if (program?.budgetMinKrw !== null && program?.budgetMinKrw !== undefined && program.budgetMinKrw > 0) known.push(program.budgetMinKrw)
  if (!known.length || basicInfo.budgetMaxKrw <= 0) return 60
  const ratio = known.reduce((sum, value) => sum + value, 0) / basicInfo.budgetMaxKrw
  return ratio <= 0.85 ? 92 : ratio <= 1.1 ? 72 : ratio <= 1.35 ? 52 : 35
}

function buildAlternatives(
  directions: readonly CampfitV3ExperienceDirection[],
  programs: readonly ScoredProgram[],
  missing: readonly string[],
): readonly string[] {
  const items: string[] = []
  const second = directions[1]
  if (second) items.push(`${second.label}도 함께 비교하면 선택 폭을 넓힐 수 있어요.`)
  if (programs.length < 2) items.push("지역이나 기간을 조정하면 더 많은 부모동반형 후보를 살펴볼 수 있어요.")
  if (missing.length) items.push("아직 확인되지 않은 조건을 보완하면 도시·프로그램 순위가 달라질 수 있어요.")
  return items
}

function takeUnique<T extends { readonly city: { readonly id: string } }>(items: T[], candidate: T | undefined): void {
  if (candidate && !items.some((item) => item.city.id === candidate.city.id)) items.push(candidate)
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "")
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value)
}
