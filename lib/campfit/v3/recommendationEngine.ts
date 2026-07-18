import {
  isoToday,
  parseDepartureRange,
  rangesOverlap,
} from "@/lib/campfit/v3/catalogPolicy"
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

type ProgramClassification = "main" | "conditional" | "alternative" | "excluded"

type ScoredProgram = {
  readonly program: V3CatalogProgram
  readonly city: V3CatalogCity | null
  readonly score: number
  readonly direction: ExperienceDirectionKey
  readonly classification: ProgramClassification
  readonly verify: readonly string[]
  readonly excludedReasons: readonly string[]
  readonly exactPrice: V3PriceOption | null
}

export function buildRecommendation(input: {
  readonly basicInfo: CampfitV3BasicInfo
  readonly state: CampfitV3ConversationState
  readonly catalog: V3Catalog
  readonly now?: Date
}): CampfitV3RecommendationResult {
  const now = input.now ?? new Date()
  const directions = scoreExperienceDirections(input.state)
  const requiredSupportConditions = supportConditions(input.state)
  const missingRequired = requiredFactLabels(input.state)

  if (input.catalog.source === "unavailable") {
    return {
      consultingConclusion: "실제 프로그램 카탈로그를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.",
      experienceDirections: directions,
      destinationRecommendations: [],
      requiredSupportConditions,
      programCandidates: [],
      verificationChecklist: Array.from(new Set([...input.catalog.warnings, ...requiredSupportConditions, ...missingRequired])),
      alternatives: ["실제 DB 카탈로그가 복구된 뒤 연령·일정·기간·부모 체류 조건을 다시 확인해야 합니다."],
      limitedResult: true,
      catalogSource: "unavailable",
    }
  }

  const scoredPrograms = scorePrograms(input.basicInfo, input.state, input.catalog, directions, now)
  const eligiblePrograms = scoredPrograms.filter((item) => item.classification !== "excluded")
  const destinations = scoreDestinations(input.basicInfo, input.state, input.catalog.cities, eligiblePrograms, directions)
  const selectedCityNames = new Set(destinations.map((destination) => normalize(destination.cityName)))
  const programCandidates = eligiblePrograms
    .filter((item) => selectedCityNames.has(normalize(item.program.city)))
    .sort(comparePrograms)
    .slice(0, 3)
    .map((item) => toProgramCandidate(item, input.basicInfo))
  const limitedResult = missingRequired.length > 0
    || destinations.length < 2
    || programCandidates.length < 2
    || input.catalog.source !== "supabase"
  const primaryDirection = directions[0]
  const sourceNotice = input.catalog.source === "static_fallback"
    ? " 현재 결과는 개발 환경의 정적 표본이며 실제 프로그램 추천으로 확정할 수 없습니다."
    : input.catalog.source === "demo"
      ? " 시연용 가상 카탈로그로 비교 기준을 보여드리는 결과이며 실제 운영·예약·가격 정보가 아닙니다."
    : ""

  return {
    consultingConclusion: primaryDirection
      ? `현재 조건에서는 ${primaryDirection.label}을 중심으로 살펴보는 편이 좋습니다. 연령·세션 일정·기간·부모 체류 범위를 통과한 후보만 비교했습니다.${sourceNotice}`
      : `현재 확인한 조건을 기준으로 부모가 같은 도시에 머무를 수 있는 프로그램을 살펴봅니다.${sourceNotice}`,
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
      ...input.catalog.warnings,
      ...(input.catalog.source === "static_fallback" ? ["개발용 정적 후보를 production 추천으로 사용하지 않기"] : []),
    ])),
    alternatives: buildAlternatives(directions, scoredPrograms, missingRequired),
    limitedResult,
    catalogSource: input.catalog.source,
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
  catalog: V3Catalog,
  directions: readonly CampfitV3ExperienceDirection[],
  now: Date,
): readonly ScoredProgram[] {
  const directionScore = new Map(directions.map((direction) => [direction.key, direction.score]))
  const cityByKey = new Map(catalog.cities.map((city) => [cityKey(city.name, city.country), city]))
  return catalog.programs.map((program) => evaluateProgram({ program, city: cityByKey.get(cityKey(program.city, program.country)) ?? null, basicInfo, state, directions, directionScore, catalogSource: catalog.source, now }))
}

function evaluateProgram(input: {
  readonly program: V3CatalogProgram
  readonly city: V3CatalogCity | null
  readonly basicInfo: CampfitV3BasicInfo
  readonly state: CampfitV3ConversationState
  readonly directions: readonly CampfitV3ExperienceDirection[]
  readonly directionScore: ReadonlyMap<ExperienceDirectionKey, number>
  readonly catalogSource: V3Catalog["source"]
  readonly now: Date
}): ScoredProgram {
  const verify: string[] = []
  const excluded: string[] = []
  const softMismatch: string[] = []
  const koreanNeed = String(input.state.facts.koreanSupportNeed?.value ?? "unknown")
  const care = String(input.state.facts.specialCareFollowUp?.value ?? "unknown")
  const communication = String(input.state.facts.parentCommunicationNeed?.value ?? "unknown")
  const childLevel = String(input.state.facts.childEnglishLevel?.value ?? "unknown")

  if (input.program.status !== "active") excluded.push("active 프로그램이 아님")
  if (input.program.parentScope.guardianNearbyCompatible === false || ["child_residential", "homestay"].includes(input.program.parentScope.stayMode)) {
    excluded.push("아이 단독 기숙·홈스테이 범위")
  } else if (input.program.parentScope.guardianNearbyCompatible === null) {
    verify.push("부모가 같은 도시에서 머무르는 낮 프로그램인지 확인")
  }

  if (input.program.ageMin === null || input.program.ageMax === null) {
    verify.push("공식 연령 범위")
  } else if (input.basicInfo.childAges.some((age) => age < input.program.ageMin! || age > input.program.ageMax!)) {
    excluded.push("아이 연령 범위 불일치")
  } else if (input.program.ageSource === "profile_inferred") {
    verify.push("공식 모집 연령 재확인")
  }

  const timing = evaluateTiming(input.program, input.basicInfo, input.now)
  if (timing.excludedReason) excluded.push(timing.excludedReason)
  verify.push(...timing.verify)

  if (input.city === null) {
    excluded.push("공개 도시 DB와 연결되지 않음")
  } else {
    const preferred = arrayValue(input.state.facts.preferredRegions?.value)
    const importance = String(input.state.facts.regionImportance?.value ?? "no_preference")
    if (importance === "must" && preferred.length && !preferred.includes(input.city.regionGroup)) excluded.push("필수 지역 조건 불일치")
    if (importance === "strong" && preferred.length && !preferred.includes(input.city.regionGroup)) softMismatch.push("강한 지역 선호와 다름")
  }

  if (koreanNeed === "must_daily") {
    if (input.program.koreanDailySupport === false) excluded.push("매일 한국어 지원 불가")
    else if (input.program.koreanDailySupport !== true) verify.push("매일 한국어 지원 범위와 담당자 상주 여부")
  } else if (koreanNeed === "emergency_only") {
    if (input.program.koreanEmergencySupport === false) excluded.push("비상 시 한국어 대응 불가")
    else if (input.program.koreanEmergencySupport !== true) verify.push("비상 시 한국어 대응 가능 여부")
  } else if (koreanNeed === "preferred" && input.program.koreanEmergencySupport !== true) {
    verify.push("필요할 때 한국어로 도움받을 수 있는 범위")
  }

  if (childLevel === "beginner") {
    if (input.program.beginnerClass === false) softMismatch.push("초급자 전용 반 미확인")
    if (input.program.beginnerClass !== true) verify.push("영어 초급자 반·초기 적응 지원")
  }
  if (input.state.facts.isFirstOverseasEducationExperience?.value === true && input.program.earlyAdaptationSupport !== true) {
    verify.push("첫 해외 교육 경험을 위한 초기 적응 지원")
  }
  if (communication === "daily" && input.program.dailyParentReport !== true) verify.push("부모에게 전달되는 활동 소식의 빈도")

  if (care === "required" || care === "unknown") {
    if (input.program.specialCareSupport === "unsupported") excluded.push("특별관리 대응 불가가 명시됨")
    else if (input.program.specialCareSupport !== "supported") verify.push("특별 식사·복약·건강·생활 지원 조건")
  }

  const exactPrice = selectPrice(input.program, input.basicInfo)
  const exactMinimumKrw = exactPrice?.currency?.toUpperCase() === "KRW" && exactPrice.priceValue !== null
    ? exactPrice.priceValue
    : null
  const referenceMinimumKrw = exactMinimumKrw ?? input.program.budgetMinKrw
  if (exactMinimumKrw !== null && exactMinimumKrw > input.basicInfo.budgetMaxKrw) {
    excluded.push("확인된 최소 프로그램비가 최대 예산을 초과")
  } else if (exactPrice === null) {
    verify.push("가족 구성·기간에 맞는 프로그램 가격")
  } else if (exactPrice !== null && exactPrice.currency?.toUpperCase() !== "KRW") {
    verify.push("프로그램비의 최신 원화 환산액")
  }

  if (input.program.catalogSource === "static_fallback") verify.push("개발용 정적 카탈로그 후보")

  const direction = bestProgramDirection(input.program, input.directions)
  const primaryDirection = input.directions[0]?.key
  const primarySignal = primaryDirection ? input.program.directionSignals[primaryDirection] : 50
  if (primaryDirection !== undefined && primarySignal < 60) excluded.push(`핵심 경험 방향(${directionLabels[primaryDirection]})을 뒷받침하는 구조화 근거 부족`)
  const goalFit = clamp((input.directionScore.get(direction) ?? 50) * 0.55 + input.program.directionSignals[direction] * 0.45)
  const beginnerFit = childLevel === "beginner" ? input.program.beginnerClass === true ? 100 : input.program.beginnerClass === false ? 30 : 55 : 75
  const supportFit = supportScore(koreanNeed, input.program)
  const budgetFit = referenceMinimumKrw === null ? 58 : referenceMinimumKrw <= input.basicInfo.budgetMaxKrw ? 90 : 25
  const demoFit = input.program.catalogSource === "demo" ? demoProgramFit(input.program, input.state) : 60
  const score = clamp(goalFit * 0.46 + beginnerFit * 0.14 + supportFit * 0.14 + budgetFit * 0.14 + demoFit * 0.07 + metadataScore(input.program) * 0.05)
  const classification: ProgramClassification = excluded.length
    ? "excluded"
    : input.catalogSource === "static_fallback"
      ? "conditional"
      : softMismatch.length > 0 || score < 62
        ? "alternative"
        : verify.length > 0
          ? "conditional"
          : "main"

  return {
    program: input.program,
    city: input.city,
    score,
    direction,
    classification,
    verify: Array.from(new Set([...verify, ...softMismatch])),
    excludedReasons: Array.from(new Set(excluded)),
    exactPrice,
  }
}

function evaluateTiming(program: V3CatalogProgram, basicInfo: CampfitV3BasicInfo, now: Date): { readonly excludedReason: string | null; readonly verify: readonly string[] } {
  const verify: string[] = []
  const today = isoToday(now)
  if (program.hasSessionRows && !program.hasScheduledSessionRows) {
    return { excludedReason: "예약 가능한 scheduled 세션이 없음", verify: [] }
  }
  const scheduled = program.sessionWindows.filter((session) => session.source !== "program_sessions" || session.status?.toLowerCase() === "scheduled")
  const future = scheduled.filter((session) => session.endDate >= today)
  if (scheduled.length > 0 && future.length === 0) return { excludedReason: "모든 확인된 세션이 종료됨", verify: [] }

  const departure = parseDepartureRange(basicInfo.departureWindow, now)
  if (!departure) verify.push("희망 출발 시기와 실제 세션 날짜")
  const overlapping = departure ? future.filter((session) => rangesOverlap(departure, session)) : future
  if (departure && scheduled.length > 0 && overlapping.length === 0) return { excludedReason: "희망 출발 시기와 세션 일정 불일치", verify: [] }

  const relevant = overlapping.length ? overlapping : future
  const canonicalRelevant = relevant.filter((session) => session.source === "program_sessions")
  if (canonicalRelevant.length > 0) {
    const sameSessionMatch = canonicalRelevant.some((session) => session.weeks === basicInfo.durationWeeks)
    if (!sameSessionMatch) {
      if (canonicalRelevant.every((session) => session.weeks !== null)) {
        return { excludedReason: "희망 출발 시기와 기간을 동시에 만족하는 세션이 없음", verify: [] }
      }
      verify.push("해당 시기 scheduled 세션의 실제 운영 기간")
    }
  } else if (program.hasScheduledSessionRows) {
    verify.push("예약 가능한 scheduled 세션의 시작일·종료일·기간")
  } else {
    verify.push("출발 시기와 기간을 동시에 만족하는 실제 scheduled 세션")
  }

  if (!program.durationWeeks.includes(basicInfo.durationWeeks)) verify.push("희망 기간의 실제 가격·예약 옵션")
  else if (!canonicalRelevant.some((session) => session.weeks === basicInfo.durationWeeks)) verify.push("가격 옵션과 실제 scheduled 세션 기간의 일치")

  if (relevant.some((session) => session.precision === "season" || session.source === "program_text")) verify.push("정확한 세션 시작일·종료일")
  if (program.sessionStatusNeedsConfirmation) verify.push("세션 모집·예약 가능 상태")
  return { excludedReason: null, verify }
}

function scoreDestinations(
  basicInfo: CampfitV3BasicInfo,
  state: CampfitV3ConversationState,
  cities: readonly V3CatalogCity[],
  programs: readonly ScoredProgram[],
  directions: readonly CampfitV3ExperienceDirection[],
): readonly CampfitV3DestinationRecommendation[] {
  const preferred = arrayValue(state.facts.preferredRegions?.value)
  const importance = String(state.facts.regionImportance?.value ?? "no_preference")
  const stayGoals = arrayValue(state.facts.parentStayGoals?.value)
  const scored = cities.flatMap((city) => {
    const cityPrograms = programs.filter((item) => cityKey(item.program.city, item.program.country) === cityKey(city.name, city.country))
    if (!cityPrograms.length) return []
    if (importance === "must" && preferred.length && !preferred.includes(city.regionGroup)) return []
    const supply = Math.min(100, 45 + cityPrograms.length * 12)
    const programFit = cityPrograms.slice(0, 3).reduce((sum, item) => sum + item.score, 0) / Math.min(3, cityPrograms.length)
    const regionFit = !preferred.length ? 70 : preferred.includes(city.regionGroup) ? 100 : importance === "strong" ? 35 : 60
    const costFit = cityBudgetFit(city, cityPrograms[0]?.program ?? null, basicInfo)
    const parentFit = parentStayFit(city, stayGoals)
    const profileFit = demoCityFit(city, directions, stayGoals)
    return [{ city, cityPrograms, balance: regionFit * 0.12 + supply * 0.17 + programFit * 0.31 + costFit * 0.14 + parentFit * 0.14 + profileFit * 0.12, preference: regionFit * 0.4 + programFit * 0.4 + profileFit * 0.2, alternative: costFit * 0.55 + parentFit * 0.35 + profileFit * 0.1 }]
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
    verify: cityVerify(item.city, stayGoals),
    costEstimate: estimateCityCost(item.city, item.cityPrograms[0]?.program ?? null, basicInfo),
  }))
}

function toProgramCandidate(item: ScoredProgram, basicInfo: CampfitV3BasicInfo): CampfitV3ProgramCandidate {
  const priceLabel = item.exactPrice?.priceValue !== null && item.exactPrice?.priceValue !== undefined && item.exactPrice.priceValue > 0
    ? `${formatNumber(item.exactPrice.priceValue)} ${item.exactPrice.currency ?? "통화 미확인"}${item.exactPrice.adultCount === 0 ? ` · 아이 ${basicInfo.childAges.length}명 프로그램비` : ""}`
    : item.program.budgetMinKrw !== null && item.program.budgetMinKrw > 0
      ? `${formatNumber(item.program.budgetMinKrw)}원부터 · 비교용`
      : "가격 확인 필요"
  const group: CampfitV3ProgramCandidate["group"] = item.classification === "main"
    ? "우선 살펴볼 프로그램"
    : item.classification === "conditional"
      ? "조건 확인 후 살펴볼 프로그램"
      : "함께 비교할 대안"
  const baseUrl = process.env["NEXT_PUBLIC_ANOGRO_SITE_URL"] ?? "https://www.anogro.com"
  const reason = item.program.catalogSource === "static_fallback"
    ? "개발 환경의 정적 표본입니다. 실제 DB 프로그램으로 확정하지 마세요."
    : item.program.catalogSource === "demo"
      ? `${item.program.demoProfile?.whyItFits[0] ?? `${directionLabels[item.direction]} 중심의 시연용 예시입니다.`}${item.program.demoProfile?.notIdealFor[0] ? ` 다만 ${item.program.demoProfile.notIdealFor[0]}에는 덜 맞을 수 있습니다.` : ""} 실제 운영·예약·가격 정보가 아닌 비교용 예시입니다.`
    : item.classification === "alternative"
      ? `${directionLabels[item.direction]} 요소는 있으나 가장 중요한 방향과 차이가 있어 대안으로만 표시합니다.`
      : `${directionLabels[item.direction]}과 연령·일정·기간·부모 체류 조건을 함께 검토한 실제 DB 후보입니다.`
  const demoVerify = item.program.catalogSource === "demo" ? item.program.demoProfile?.verificationChecklist ?? [] : []
  return {
    programId: item.program.id,
    name: item.program.name,
    cityName: item.program.city,
    countryName: item.program.country,
    imageUrl: item.program.imageUrl,
    ageLabel: item.program.ageMin !== null && item.program.ageMax !== null ? `만 ${item.program.ageMin}~${item.program.ageMax}세` : "연령 확인 필요",
    durationLabel: item.program.durationWeeks.length ? `${item.program.durationWeeks.join("·")}주 옵션` : "기간 확인 필요",
    priceLabel,
    primaryDirection: directionLabels[item.direction],
    reason,
    verify: item.verify.length ? Array.from(new Set([...item.verify, ...demoVerify])) : demoVerify.length ? demoVerify : ["최신 일정과 실제 수업 구성"],
    detailUrl: item.program.catalogSource === "demo" ? null : item.program.slug ? `${baseUrl}/program/${encodeURIComponent(item.program.slug)}` : null,
    group,
    score: item.score,
  }
}

function estimateCityCost(city: V3CatalogCity, program: V3CatalogProgram | null, basicInfo: CampfitV3BasicInfo): CampfitV3CostEstimate {
  const days = basicInfo.durationWeeks * 7
  const minComponents: number[] = []
  const maxComponents: number[] = []
  const included: string[] = []
  const missing: string[] = []
  let hasCompleteMaximum = true
  const exactPrice = program ? selectPrice(program, basicInfo) : null
  if (exactPrice?.currency?.toUpperCase() === "KRW" && exactPrice.priceValue !== null && exactPrice.priceValue > 0) {
    minComponents.push(exactPrice.priceValue)
    maxComponents.push(exactPrice.priceValue)
    included.push("프로그램비")
  } else if (program?.budgetMinKrw !== null && program?.budgetMinKrw !== undefined && program.budgetMinKrw > 0) {
    minComponents.push(program.budgetMinKrw)
    if (program.budgetMaxKrw !== null && program.budgetMaxKrw > 0) maxComponents.push(program.budgetMaxKrw)
    else {
      hasCompleteMaximum = false
      missing.push("프로그램비 최대값")
    }
    included.push("프로그램비 참고값")
  } else {
    missing.push("프로그램비")
    hasCompleteMaximum = false
  }
  if (city.flightCostKrw !== null) {
    minComponents.push(city.flightCostKrw)
    maxComponents.push(city.flightCostKrw)
    included.push("항공비 참고값")
    missing.push("가족 항공권 실제 견적")
  } else missing.push("항공비")
  if (city.housingCostMonthlyKrw !== null) {
    const value = city.housingCostMonthlyKrw * days / 30
    minComponents.push(value)
    maxComponents.push(value)
    included.push("주거비 참고값")
  } else missing.push("주거비")
  if (city.livingCostMonthlyKrw !== null) {
    const value = city.livingCostMonthlyKrw * days / 30
    minComponents.push(value)
    maxComponents.push(value)
    included.push("생활비 참고값")
  } else missing.push("생활비")
  missing.push("현지 교통비", "보험·비자")
  const min = minComponents.length ? Math.round(minComponents.reduce((sum, value) => sum + value, 0)) : null
  const max = hasCompleteMaximum && maxComponents.length ? Math.round(maxComponents.reduce((sum, value) => sum + value, 0)) : null
  return {
    estimatedTotalMinKrw: min,
    estimatedTotalMaxKrw: max,
    includedComponents: included,
    missingComponents: Array.from(new Set(missing)),
    confidence: missing.length ? "low" : exactPrice?.currency?.toUpperCase() === "KRW" ? "medium" : "low",
    label: "비교용 추정",
  }
}

function selectPrice(program: V3CatalogProgram, basicInfo: CampfitV3BasicInfo): V3PriceOption | null {
  const campParticipantCount = basicInfo.childAges.length
  const matching = program.priceOptions.filter((option) => option.status?.toLowerCase() === "active"
    && option.childCount === campParticipantCount
    && option.durationWeeks === basicInfo.durationWeeks)
  const exactFamily = matching.find((option) => option.adultCount === basicInfo.adultCount)
  if (exactFamily) return exactFamily
  if (program.parentScope.stayMode === "day" || program.catalogSource === "demo") return matching.find((option) => option.adultCount === 0) ?? null
  return null
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

function bestProgramDirection(program: V3CatalogProgram, directions: readonly CampfitV3ExperienceDirection[]): ExperienceDirectionKey {
  return (Object.keys(directionLabels) as readonly ExperienceDirectionKey[])
    .map((key) => ({ key, score: program.directionSignals[key] * 0.6 + (directions.find((direction) => direction.key === key)?.score ?? 0) * 0.4 }))
    .sort((left, right) => right.score - left.score)[0]?.key ?? "cultureActivity"
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
  const parts = [`조건을 통과한 부모 체류 호환 프로그램 ${programCount}개가 실제 카탈로그에 있습니다.`]
  if (preferred) parts.push("사용자가 선택한 지역 선호와도 일치합니다.")
  if (city.catalogSource === "demo") {
    if (city.demoProfile?.idealFor[0]) parts.push(city.demoProfile.idealFor[0])
    parts.push("시연용 도시 예시이므로 실제 이동·숙박·운영 조건은 별도 확인이 필요합니다.")
  }
  return parts.join(" ")
}

function cityVerify(city: V3CatalogCity, stayGoals: readonly string[]): readonly string[] {
  const items = ["프로그램과 숙소 사이 실제 이동시간"]
  if (city.flightCostKrw === null) items.push("항공료")
  else items.push("항공료의 왕복·출발지·시즌 기준")
  if (city.housingCostMonthlyKrw === null) items.push("단기 가족 숙소 가격")
  else items.push("도심 1BR 월 비용과 실제 단기 가족 숙소의 차이")
  if (stayGoals.includes("remoteWork") && !hasParentStayEvidence(city, "remoteWork")) items.push("인터넷·업무공간 등 원격근무 환경")
  if (city.catalogSource === "demo") items.push(...(city.demoProfile?.verificationChecklist ?? []))
  return items
}

function parentStayFit(city: V3CatalogCity, stayGoals: readonly string[]): number {
  if (!stayGoals.length || stayGoals.includes("childScheduleFirst")) return 70
  const matches = stayGoals.filter((goal) => hasParentStayEvidence(city, goal)).length
  return matches ? Math.min(88, 68 + matches * 8) : 60
}

function hasParentStayEvidence(city: V3CatalogCity, goal: string): boolean {
  const text = city.parentStayEvidence ?? ""
  if (goal === "remoteWork") return /(remote|cowork|co-work|internet|wifi|digital\s*nomad|원격|코워킹|인터넷)/i.test(text)
  if (goal === "restWellness") return /(wellness|spa|massage|휴식|웰니스|마사지)/i.test(text)
  if (goal === "cafeDining") return /(cafe|restaurant|dining|카페|식당|맛집)/i.test(text)
  if (goal === "tourismCulture") return /(tour|museum|culture|관광|문화|박물관)/i.test(text)
  if (goal === "natureBeach") return /(nature|beach|park|자연|해변|바다|공원)/i.test(text)
  return false
}

function cityBudgetFit(city: V3CatalogCity, program: V3CatalogProgram | null, basicInfo: CampfitV3BasicInfo): number {
  const estimate = estimateCityCost(city, program, basicInfo)
  if (estimate.estimatedTotalMinKrw === null || basicInfo.budgetMaxKrw <= 0) return 60
  const ratio = estimate.estimatedTotalMinKrw / basicInfo.budgetMaxKrw
  return ratio <= 0.85 ? 92 : ratio <= 1.1 ? 72 : ratio <= 1.35 ? 52 : 35
}

function supportScore(need: string, program: V3CatalogProgram): number {
  if (need === "must_daily") return program.koreanDailySupport === true ? 100 : program.koreanDailySupport === false ? 20 : 55
  if (need === "emergency_only") return program.koreanEmergencySupport === true ? 100 : program.koreanEmergencySupport === false ? 20 : 55
  if (need === "preferred") return program.koreanEmergencySupport === true ? 92 : 65
  return 80
}

function metadataScore(program: V3CatalogProgram): number {
  let score = 40
  if (program.ageMin !== null && program.ageMax !== null) score += 15
  if (program.sessionWindows.length) score += 20
  if (program.durationSource === "session_or_price") score += 15
  if (program.updatedAt) score += 10
  return Math.min(100, score)
}

function demoCityFit(city: V3CatalogCity, directions: readonly CampfitV3ExperienceDirection[], stayGoals: readonly string[]): number {
  const profile = city.demoProfile
  if (!profile) return 70
  const primary = directions[0]?.key
  const directionScore = primary ? levelScore(profile.experienceStrengths[primary]) : 70
  const stayScore = stayGoals.length
    ? Math.round(stayGoals.reduce((sum, goal) => sum + levelScore(profile.parentStayProfile[goal]), 0) / stayGoals.length)
    : 70
  const mobilityScore = levelScore(profile.mobilityProfile["dailyCommuteEase"])
  return Math.round(directionScore * 0.55 + stayScore * 0.3 + mobilityScore * 0.15)
}

function demoProgramFit(program: V3CatalogProgram, state: CampfitV3ConversationState): number {
  const profile = program.demoProfile
  if (!profile) return 60
  const goals = arrayValue(state.facts.parentStayGoals?.value)
  const parentMatches = goals.filter((goal) => profile.parentCompatibilitySignals.some((signal) => signal.toLowerCase().includes(goal.toLowerCase()))).length
  const parentScore = goals.length ? Math.min(100, 65 + parentMatches * 15) : 70
  const childLevel = String(state.facts.childEnglishLevel?.value ?? "unknown")
  const beginnerScore = childLevel === "beginner" && profile.childExperienceSignals.some((signal) => /beginner|first|low_language/i.test(signal)) ? 95 : 70
  return Math.round(parentScore * 0.55 + beginnerScore * 0.45)
}

function levelScore(value: unknown): number {
  return value === "high" ? 100 : value === "medium" ? 72 : value === "low" ? 42 : 60
}

function comparePrograms(left: ScoredProgram, right: ScoredProgram): number {
  const rank: Readonly<Record<ProgramClassification, number>> = { main: 0, conditional: 1, alternative: 2, excluded: 3 }
  return rank[left.classification] - rank[right.classification] || right.score - left.score || left.program.id.localeCompare(right.program.id)
}

function buildAlternatives(
  directions: readonly CampfitV3ExperienceDirection[],
  programs: readonly ScoredProgram[],
  missing: readonly string[],
): readonly string[] {
  const items: string[] = []
  const second = directions[1]
  if (second) items.push(`${second.label}도 함께 비교하면 선택 폭을 넓힐 수 있어요.`)
  const excludedCount = programs.filter((program) => program.classification === "excluded").length
  const eligibleCount = programs.length - excludedCount
  if (eligibleCount < 2) items.push("현재 active·public 카탈로그에서 조건을 통과한 후보가 적습니다. 지역·시기·기간을 조정해 다시 확인할 수 있어요.")
  if (excludedCount) items.push(`${excludedCount}개 프로그램은 연령·일정·기간·부모 체류·지원·예산 하드 조건으로 제외했습니다.`)
  if (missing.length) items.push("아직 확인되지 않은 조건을 보완하면 도시·프로그램 순위가 달라질 수 있어요.")
  return items
}

function takeUnique<T extends { readonly city: { readonly id: string } }>(items: T[], candidate: T | undefined): void {
  if (candidate && !items.some((item) => item.city.id === candidate.city.id)) items.push(candidate)
}

function arrayValue(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function cityKey(city: string, country: string): string {
  return `${normalize(country)}|${normalize(city)}`
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
