import {
  isoToday,
  parseDepartureRange,
  rangesOverlap,
} from "@/lib/campfit/v3/catalogPolicy"
import type { ExperienceSignalStatus, V3ParentStayPreferences } from "@/lib/campfit/v3/catalogPolicy"
import type {
  V3Catalog,
  V3CatalogCity,
  V3CatalogProgram,
  V3CatalogSessionVariant,
  V3PriceOption,
} from "@/lib/campfit/v3/catalogRepository"
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

type PriceMatchStatus = "exact_quote" | "partial_quote" | "estimated_quote" | "price_unknown" | "confirmed_over_budget"
type VariantDecisionStatus = "confirmed_match" | "confirmed_mismatch" | "needs_confirmation" | "unknown"

type SessionVariantAssessment = {
  readonly variant: V3CatalogSessionVariant
  readonly scheduleStatus: VariantDecisionStatus
  readonly durationStatus: VariantDecisionStatus
  readonly selectedDurationWeeks: number | null
  readonly matchingPriceOptions: readonly V3PriceOption[]
  readonly confidence: "high" | "medium" | "low"
}

type PriceAssessment = {
  readonly status: PriceMatchStatus
  readonly option: V3PriceOption | null
  readonly matchingOptions: readonly V3PriceOption[]
}

type ScoredProgram = {
  readonly program: V3CatalogProgram
  readonly city: V3CatalogCity | null
  readonly score: number
  readonly direction: ExperienceDirectionKey
  readonly classification: ProgramClassification
  readonly verify: readonly string[]
  readonly excludedReasons: readonly string[]
  readonly exactPrice: V3PriceOption | null
  readonly sessionAssessment: SessionVariantAssessment | null
  readonly priceAssessment: PriceAssessment
}

export type V3RecommendationParentPreferences = V3ParentStayPreferences

export function buildRecommendation(input: {
  readonly basicInfo: CampfitV3BasicInfo
  readonly state: CampfitV3ConversationState
  readonly catalog: V3Catalog
  /** Optional internal preference projection; absent values remain unknown. */
  readonly parentPreferences?: V3RecommendationParentPreferences
  readonly now?: Date
}): CampfitV3RecommendationResult {
  const now = input.now ?? new Date()
  const directions = scoreExperienceDirections(input.state)
  const requiredSupportConditions = supportConditions(input.state)
  const missingRequired = requiredFactLabels(input.state)
  const parentPreferences = input.parentPreferences ?? inferParentStayPreferences(input.basicInfo, input.state)

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

  const scoredPrograms = scorePrograms(input.basicInfo, input.state, input.catalog, directions, parentPreferences, now)
  const eligiblePrograms = scoredPrograms.filter((item) => item.classification !== "excluded")

  console.log("DEBUG: Total scored programs:", scoredPrograms.length)
  console.log("DEBUG: Eligible programs:", eligiblePrograms.map(p => `${p.program.name} (${p.program.city}) - class: ${p.classification}, score: ${p.score}`))
  console.log("DEBUG: Excluded program reasons (sample):", scoredPrograms.filter(p => p.classification === "excluded").slice(0, 15).map(p => `${p.program.name} (${p.program.city}): ${p.excludedReasons.join(", ")} | durations: ${p.program.durationWeeks.join(",")} | age: ${p.program.ageMin}-${p.program.ageMax}`))

  const destinations = scoreDestinations(input.basicInfo, input.state, input.catalog.cities, scoredPrograms, directions)
  const sortedEligiblePrograms = eligiblePrograms.sort(comparePrograms)
  // City and program recommendations are independent lists. A strong program
  // in a city outside the city Top3 must still be eligible for the program Top3.
  let programCandidates = selectDiverseProgramCandidates(sortedEligiblePrograms, 3)
    .map((item) => toProgramCandidate(item, input.basicInfo))

  if (destinations.length > 0 && destinations[0]) {
    const firstCityName = destinations[0].cityName
    const hasFirstCityProgram = programCandidates.some((c) => c.cityName.toLowerCase() === firstCityName.toLowerCase())
    if (!hasFirstCityProgram) {
      const fallbackProgram = sortedEligiblePrograms.find((item) => item.program.city.toLowerCase() === firstCityName.toLowerCase())
      if (fallbackProgram) {
        const fallbackCandidate = toProgramCandidate(fallbackProgram, input.basicInfo)
        programCandidates = [
          programCandidates[0] ?? null,
          programCandidates[1] ?? null,
          fallbackCandidate,
        ].filter((c): c is CampfitV3ProgramCandidate => c !== null)
      }
    }
  }
  const limitedResult = missingRequired.length > 0
    || destinations.length < 3
    || programCandidates.length < 3
    || input.catalog.source !== "supabase"
  const primaryDirection = directions[0]
  return {
    consultingConclusion: primaryDirection
      ? `현재 조건에서는 ${primaryDirection.label}을 중심으로 살펴보는 편이 좋습니다. 연령·세션 일정·기간·부모 체류 범위를 통과한 후보만 비교했습니다.`
      : `현재 확인한 조건을 기준으로 부모가 같은 도시에 머무를 수 있는 프로그램을 살펴봅니다.`,
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
  parentPreferences: V3ParentStayPreferences,
  now: Date,
): readonly ScoredProgram[] {
  const directionScore = new Map(directions.map((direction) => [direction.key, direction.score]))
  const cityByKey = new Map(catalog.cities.map((city) => [cityKey(city.name, city.country), city]))
  return catalog.programs.map((program) => evaluateProgram({ program, city: cityByKey.get(cityKey(program.city, program.country)) ?? null, basicInfo, state, directions, parentPreferences, directionScore, catalogSource: catalog.source, now }))
}

function evaluateProgram(input: {
  readonly program: V3CatalogProgram
  readonly city: V3CatalogCity | null
  readonly basicInfo: CampfitV3BasicInfo
  readonly state: CampfitV3ConversationState
  readonly directions: readonly CampfitV3ExperienceDirection[]
  readonly parentPreferences: V3ParentStayPreferences
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
  const parentCheck = evaluateParentCompatibility(input.program.parentScope, input.parentPreferences)
  excluded.push(...parentCheck.excluded)
  verify.push(...parentCheck.verify)

  if (input.program.ageMin === null || input.program.ageMax === null) {
    verify.push("공식 연령 범위")
  } else if (input.basicInfo.childAges.some((age) => age < input.program.ageMin! || age > input.program.ageMax!)) {
    excluded.push("아이 연령 범위 불일치")
  } else if (input.program.ageSource === "profile_inferred") {
    verify.push("공식 모집 연령 재확인")
  }

  const timing = evaluateTimingVariant(input.program, input.basicInfo, input.now)
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

  const priceAssessment = assessPrice(input.program, input.basicInfo)
  const exactPrice = priceAssessment.option
  const exactMinimumKrw = exactPrice?.currency?.toUpperCase() === "KRW" && exactPrice.priceValue !== null
    ? exactPrice.priceValue
    : null
  const referenceMinimumKrw = exactMinimumKrw ?? input.program.budgetMinKrw
  if (priceAssessment.status === "partial_quote") verify.push("부모 숙소를 포함한 가격도 확인")
  if (exactMinimumKrw !== null && exactMinimumKrw > input.basicInfo.budgetMaxKrw) {
    excluded.push("확인된 최소 프로그램비가 최대 예산을 초과")
  } else if (exactPrice === null) {
    verify.push("가족 구성·기간에 맞는 프로그램 가격")
  } else if (exactPrice !== null && exactPrice.currency?.toUpperCase() !== "KRW") {
    verify.push("프로그램비의 최신 원화 환산액")
  }

  const direction = bestProgramDirection(input.program, input.directions)
  const primaryDirection = input.directions[0]?.key
  const primarySignal = primaryDirection ? programExperienceScore(input.program, primaryDirection) : 50
  const primaryStatus = primaryDirection ? programExperienceStatus(input.program, primaryDirection) : undefined
  if (primaryDirection !== undefined && primarySignal < 60) {
    softMismatch.push(
      primaryStatus === "unknown" || (primaryStatus === undefined && primarySignal <= 15)
        ? `핵심 경험 방향(${directionLabels[primaryDirection]})의 구조화 근거 미확인`
        : `핵심 경험 방향(${directionLabels[primaryDirection]}) 적합도가 낮음`,
    )
  }
  const goalFit = clamp(
    (input.directionScore.get(direction) ?? 50) * 0.55
      + directionSignalForScoring(programExperienceScore(input.program, direction), programExperienceStatus(input.program, direction)) * 0.45,
  )
  const beginnerFit = childLevel === "beginner" ? input.program.beginnerClass === true ? 100 : input.program.beginnerClass === false ? 30 : 55 : 75
  const supportFit = supportScore(koreanNeed, input.program)
  const budgetFit = referenceMinimumKrw === null ? 58 : referenceMinimumKrw <= input.basicInfo.budgetMaxKrw ? 90 : 25
  const score = clamp(goalFit * 0.46 + beginnerFit * 0.14 + supportFit * 0.14 + budgetFit * 0.14 + 60 * 0.07 + metadataScore(input.program) * 0.05)
  const classification: ProgramClassification = excluded.length
    ? "excluded"
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
    sessionAssessment: timing.assessment ?? null,
    priceAssessment,
  }
}

function evaluateParentCompatibility(
  scope: V3CatalogProgram["parentScope"],
  preferences: V3ParentStayPreferences,
): { readonly excluded: readonly string[]; readonly verify: readonly string[] } {
  const excluded: string[] = []
  const verify: string[] = []
  const assessment = scope.assessment

  if (!assessment) {
    // Keep old fixture compatibility while all production catalog programs use the normalized assessment above.
    if (scope.guardianNearbyCompatible === false || ["child_residential", "homestay"].includes(scope.stayMode)) {
      excluded.push("아이 단독 기숙·홈스테이 범위")
    } else if (scope.guardianNearbyCompatible === null) {
      verify.push("부모가 같은 도시에서 머무르는 낮 프로그램인지 확인")
    }
    return { excluded, verify }
  }

  if (assessment.parentCityStayCompatibility === "incompatible" && preferences.parentCityStay === "required") {
    excluded.push("부모 체류·숙소 조건 불일치")
  }
  if (assessment.parentProgramParticipation === "required" && preferences.parentProgramParticipation === "not_required") {
    excluded.push("부모 공동 참여 조건 불일치")
  }
  if (assessment.childParticipationMode === "day_independent" && preferences.dayProgramIndependent === "not_allowed") {
    excluded.push("낮 프로그램 독립 참여 조건 불일치")
  }

  const residentialChildOnly = assessment.childLodgingMode === "residential_camp" || assessment.childLodgingMode === "homestay"
  const noParentAlternative = assessment.parentCityStayCompatibility === "incompatible"
    && assessment.parentLodgingCompatibility === "not_available"
  if (residentialChildOnly && preferences.childResidential === "not_allowed" && noParentAlternative) {
    excluded.push("아이 단독 기숙·홈스테이 조건 불일치")
  }
  if (preferences.sameLodging === "required"
    && assessment.parentLodgingCompatibility !== "same_lodging_available"
    && assessment.parentLodgingCompatibility !== "unknown") {
    excluded.push("필수 동일 숙소 조건 불일치")
  }

  if (excluded.length === 0 && (assessment.parentFitStatus !== "match"
    || assessment.parentLodgingCompatibility === "unknown"
    || assessment.parentLodgingCompatibility === "not_available")) {
    verify.push(...assessment.parentFitReasons)
    if (assessment.parentFitStatus === "mismatch" && assessment.parentFitReasons.length === 0) {
      verify.push("프로그램의 부모 체류 규정과 사용자 조건의 충돌 여부 확인")
    }
  }
  return { excluded, verify: Array.from(new Set(verify)) }
}

function inferParentStayPreferences(
  basicInfo: CampfitV3BasicInfo,
  state: CampfitV3ConversationState,
): V3ParentStayPreferences {
  const separation = state.facts.dayProgramSeparationReadiness?.value
  return {
    parentCityStay: basicInfo.guardianStaysNearby === true ? "required" : "unknown",
    parentProgramParticipation: "unknown",
    sameLodging: "unknown",
    childResidential: "unknown",
    dayProgramIndependent: separation === "ready" ? "allowed" : separation === "needs_close_support" ? "not_allowed" : "unknown",
    nearbyLodging: "unknown",
  }
}

function evaluateTimingVariant(program: V3CatalogProgram, basicInfo: CampfitV3BasicInfo, now: Date): {
  readonly excludedReason: string | null
  readonly verify: readonly string[]
  readonly assessment: SessionVariantAssessment | null
} {
  const today = isoToday(now)
  const variants = catalogSessionVariants(program, today)
  const departure = parseDepartureRange(basicInfo.departureWindow, now)
  const verify: string[] = []

  if (!departure) verify.push("여행 출발 시기와 실제 세션 날짜")
  if (!variants.length) {
    verify.push("예약 가능한 세션의 시작·종료일·기간")
    return { excludedReason: null, verify, assessment: null }
  }

  const matchingPriceOptions = inputPriceOptionsFor(program, basicInfo)
  const assessments = variants.map((variant) => assessSessionVariant(variant, departure, basicInfo.durationWeeks, today, matchingPriceOptions))
  const viable = assessments.filter((item) => item.variant.availabilityStatus !== "closed"
    && item.variant.availabilityStatus !== "confirmed_unavailable"
    && item.scheduleStatus !== "confirmed_mismatch"
    && item.durationStatus !== "confirmed_mismatch")
  const best = [...viable].sort(compareVariantAssessments)[0]
    ?? [...assessments].sort(compareVariantAssessments)[0]
    ?? null

  if (!viable.length) {
    const allClosed = assessments.every((item) => ["closed", "confirmed_unavailable"].includes(item.variant.availabilityStatus))
    if (allClosed) return { excludedReason: "모든 확인된 세션이 종료됨", verify: [], assessment: best }
    const scheduleMismatch = assessments.length > 0 && assessments.every((item) => item.scheduleStatus === "confirmed_mismatch")
    if (scheduleMismatch) return { excludedReason: "희망 출발 시기와 세션 일정 불일치", verify: [], assessment: best }
    const durationMismatch = assessments.length > 0 && assessments.every((item) => item.durationStatus === "confirmed_mismatch")
    if (durationMismatch) return { excludedReason: "희망 기간과 일치하는 세션이 없음", verify: [], assessment: best }
    return { excludedReason: "희망 출발 시기와 기간을 동시에 만족하는 세션이 없음", verify: [], assessment: best }
  }

  if (best) {
    if (best.variant.availabilityStatus === "needs_inquiry") verify.push("해당 세션의 모집 가능 여부 문의")
    if (best.variant.availabilityStatus === "likely_available") verify.push("세션 모집 상태와 정확한 시작일 확인")
    if (best.variant.availabilityStatus === "unknown") verify.push("세션 운영 상태 확인")
    if (best.scheduleStatus !== "confirmed_match") verify.push("희망 출발 시기와 실제 세션 일정 확인")
    if (best.durationStatus === "needs_confirmation" || best.durationStatus === "unknown") verify.push("요청 기간의 실제 운영 가능 여부 확인")
    if (best.durationStatus === "confirmed_match" && best.variant.availableDurationWeeks.length > 1) verify.push("선택한 세션의 정확한 운영 기간 확인")
    if (best.variant.source === "program_text") verify.push("정확한 세션 시작·종료일 확인")
  }
  return { excludedReason: null, verify: Array.from(new Set(verify)), assessment: best }
}

function catalogSessionVariants(program: V3CatalogProgram, today: string): readonly V3CatalogSessionVariant[] {
  if (program.sessionVariants?.length) return program.sessionVariants
  const legacy = program.sessionWindows.map((session): V3CatalogSessionVariant => ({
    programId: program.id,
    sessionId: null,
    startDate: session.startDate,
    endDate: session.endDate,
    availableDurationWeeks: session.weeks === null ? [] : [session.weeks],
    availabilityStatus: session.status?.toLowerCase() === "inquiry"
      ? "needs_inquiry"
      : session.endDate < today
        ? "closed"
        : session.source === "program_sessions" && session.status?.toLowerCase() === "scheduled"
          ? "confirmed_available"
          : "likely_available",
    status: session.status,
    label: null,
    note: null,
    source: session.source,
    evidence: [{ source: `${session.source}.date_range`, value: `${session.startDate}/${session.endDate}`, confidence: session.precision === "exact" ? "high" : "low" }],
  }))
  if (legacy.length || !program.priceOptions.length) return legacy
  return [{
    programId: program.id,
    sessionId: null,
    startDate: null,
    endDate: null,
    availableDurationWeeks: [...program.durationWeeks],
    availabilityStatus: "likely_available",
    status: null,
    label: null,
    note: null,
    source: "price_option",
    evidence: [{ source: "program_price_options.duration_weeks", value: program.durationWeeks.join(","), confidence: program.durationWeeks.length ? "high" : "low" }],
  }]
}

function assessSessionVariant(
  variant: V3CatalogSessionVariant,
  departure: ReturnType<typeof parseDepartureRange>,
  requestedDurationWeeks: number,
  today: string,
  matchingPriceOptions: readonly V3PriceOption[],
): SessionVariantAssessment {
  const exactDates = variant.startDate !== null && variant.endDate !== null
  const scheduleStatus: VariantDecisionStatus = !departure
    ? "unknown"
    : exactDates
      ? rangesOverlap(departure, { startDate: variant.startDate!, endDate: variant.endDate! })
        ? "confirmed_match"
        : variant.availabilityStatus === "needs_inquiry" || variant.availabilityStatus === "unknown" || variant.availabilityStatus === "likely_available"
          ? "needs_confirmation"
          : "confirmed_mismatch"
      : variant.availabilityStatus === "needs_inquiry" || variant.availabilityStatus === "likely_available"
        ? "needs_confirmation"
        : "unknown"
  const knownDurations = variant.availableDurationWeeks
  const durationStatus: VariantDecisionStatus = knownDurations.length === 0
    ? "unknown"
    : knownDurations.includes(requestedDurationWeeks)
      ? (knownDurations.length > 1 && variant.source === "program_sessions" ? "needs_confirmation" : "confirmed_match")
      : variant.availabilityStatus === "needs_inquiry" || variant.availabilityStatus === "likely_available" || variant.availabilityStatus === "unknown"
        ? "needs_confirmation"
        : "confirmed_mismatch"
  return {
    variant,
    scheduleStatus,
    durationStatus,
    selectedDurationWeeks: knownDurations.includes(requestedDurationWeeks) ? requestedDurationWeeks : null,
    matchingPriceOptions,
    confidence: exactDates && knownDurations.length ? "high" : exactDates || knownDurations.length ? "medium" : "low",
  }
}

function inputPriceOptionsFor(program: V3CatalogProgram, basicInfo: CampfitV3BasicInfo): readonly V3PriceOption[] {
  return program.priceOptions.filter((option) => option.status?.toLowerCase() === "active"
    && option.childCount === basicInfo.childAges.length
    && option.durationWeeks === basicInfo.durationWeeks)
}

function compareVariantAssessments(left: SessionVariantAssessment, right: SessionVariantAssessment): number {
  const availabilityRank: Record<V3CatalogSessionVariant["availabilityStatus"], number> = {
    confirmed_available: 5,
    likely_available: 4,
    needs_inquiry: 3,
    unknown: 2,
    confirmed_unavailable: 1,
    closed: 0,
  }
  const statusRank = (value: VariantDecisionStatus) => ({ confirmed_match: 4, needs_confirmation: 3, unknown: 2, confirmed_mismatch: 0 }[value])
  return availabilityRank[right.variant.availabilityStatus] - availabilityRank[left.variant.availabilityStatus]
    || statusRank(right.scheduleStatus) - statusRank(left.scheduleStatus)
    || statusRank(right.durationStatus) - statusRank(left.durationStatus)
}

function assessPrice(program: V3CatalogProgram, basicInfo: CampfitV3BasicInfo): PriceAssessment {
  const childCount = basicInfo.childAges.length
  const matchingOptions = program.priceOptions.filter((option) => option.status?.toLowerCase() === "active"
    && option.childCount === childCount
    && option.durationWeeks === basicInfo.durationWeeks)
  const exactFamily = matchingOptions.find((option) => option.adultCount === basicInfo.adultCount)
  if (exactFamily) {
    const hasExactAmount = exactFamily.priceValue !== null && exactFamily.currency !== null
    const overBudget = hasExactAmount && exactFamily.currency?.toUpperCase() === "KRW"
      && exactFamily.priceValue !== null
      && exactFamily.priceValue > basicInfo.budgetMaxKrw
    return { status: overBudget ? "confirmed_over_budget" : hasExactAmount ? "exact_quote" : "price_unknown", option: hasExactAmount ? exactFamily : null, matchingOptions }
  }
  if (program.parentScope.stayMode === "day") {
    const childOnly = matchingOptions.find((option) => option.adultCount === 0) ?? null
    const hasChildAmount = childOnly?.priceValue !== null && childOnly?.currency !== null
    return { status: hasChildAmount ? "partial_quote" : "price_unknown", option: hasChildAmount ? childOnly : null, matchingOptions }
  }
  return { status: "price_unknown", option: null, matchingOptions }
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
  const priorities = cityPriorityText(state)
  const scored = cities.flatMap((city) => {
    if (importance === "must" && preferred.length && !preferred.includes(city.regionGroup)) return []
    const regionFit = !preferred.length ? 70 : preferred.includes(city.regionGroup) ? 100 : importance === "strong" ? 35 : 60
    const cityCostProgram = programs.find((item) => cityKey(item.program.city, item.program.country) === cityKey(city.name, city.country))?.program ?? null
    const costFit = cityBudgetFit(city, cityCostProgram, basicInfo)
    const parentFit = parentStayFit(city, stayGoals)
    const profileFit = cityProfileFit(city, priorities)
    return [{ city, balance: regionFit * 0.12 + costFit * 0.18 + parentFit * 0.18 + profileFit * 0.52 }]
  })
  const selected = [...scored].sort((a, b) => b.balance - a.balance).slice(0, 3)
  const roles: readonly CampfitV3DestinationRecommendation["role"][] = ["가장 균형 잡힌 선택", "원래 희망을 가장 잘 살리는 선택", "비용·부모 체류 관점의 대안"]
  return selected.map((item, index): CampfitV3DestinationRecommendation => {
    const role = roles[index] ?? "가장 균형 잡힌 선택"
    return {
      cityId: item.city.id,
      cityName: item.city.name,
      countryName: item.city.country,
      role,
      imageUrl: item.city.imageUrl,
      reason: cityReason(item.city, preferred.includes(item.city.regionGroup), priorities),
      verify: cityVerify(item.city, stayGoals),
      costEstimate: estimateCityCost(item.city, programs.find((program) => cityKey(program.program.city, program.program.country) === cityKey(item.city.name, item.city.country))?.program ?? null, basicInfo),
      cityStayFlightCostKrw: cityStayFlightCost(item.city, basicInfo),
      cityStayMonthlyCostKrw: cityStayMonthlyCost(item.city, basicInfo),
      singleFlightCostKrw: item.city.flightCostKrw,
      livingCostMonthlyKrw: item.city.livingCostMonthlyKrw,
      housingCostMonthlyKrw: item.city.housingCostMonthlyKrw,
      description: item.city.description,
      bullets: buildCityWhyBullets(item.city, role, stayGoals),
    }
  })
}

function buildCityWhyBullets(city: V3CatalogCity, role: string, stayGoals: readonly string[]): readonly string[] {
  const list: string[] = []
  list.push(role)

  const profile = city.profile
  if (profile) {
    if (profile.safetyLevel === "high") {
      list.push("현지 치안 및 주변 안전 환경이 우수하여 가족 체류에 적합해요.")
    }
    if (profile.medicalLevel === "high") {
      list.push("인근 종합병원 등 의료 인프라 접근성이 확보된 안전한 환경이에요.")
    }
  }

  if (city.livingCostMonthlyKrw !== null && city.livingCostMonthlyKrw < 1500000) {
    list.push("체류 생활비와 숙소 렌트 비용이 다른 대안 도시에 비해 합리적이에요.")
  }

  if (list.length < 3) {
    if (stayGoals.includes("natureBeach")) {
      list.push("휴양지 특유의 자연 경관 및 해변 활동 접근성이 매우 좋아요.")
    } else if (stayGoals.includes("restWellness")) {
      list.push("가족 모두 조용하고 여유롭게 휴식과 웰니스를 취하기 좋은 환경이에요.")
    } else if (stayGoals.includes("remoteWork")) {
      list.push("부모의 원격 업무 수행과 조용한 생활 인프라가 지원돼요.")
    }
  }

  return Array.from(new Set(list)).slice(0, 3)
}

function cityStayFlightCost(city: V3CatalogCity, basicInfo: CampfitV3BasicInfo): number | null {
  return city.flightCostKrw === null ? null : city.flightCostKrw * (basicInfo.adultCount + basicInfo.childCount)
}

function cityStayMonthlyCost(city: V3CatalogCity, basicInfo: CampfitV3BasicInfo): number | null {
  const parts = [
    cityStayFlightCost(city, basicInfo),
    city.livingCostMonthlyKrw,
    city.housingCostMonthlyKrw,
  ]
  return parts.every((value): value is number => value !== null) ? parts.reduce((sum, value) => sum + value, 0) : null
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
  const reason = item.classification === "alternative"
    ? `${directionLabels[item.direction]} 요소는 있으나 가장 중요한 방향과 차이가 있어 대안으로만 표시합니다.`
    : `${directionLabels[item.direction]}과 연령·일정·기간·부모 체류 조건을 함께 검토한 실제 DB 후보입니다.`
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
    verify: item.verify.length ? item.verify : ["최신 일정과 실제 수업 구성"],
    detailUrl: item.program.slug ? `${baseUrl}/program/${encodeURIComponent(item.program.slug)}` : null,
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
    const totalFlightCost = city.flightCostKrw * (basicInfo.adultCount + basicInfo.childCount)
    minComponents.push(totalFlightCost)
    maxComponents.push(totalFlightCost)
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
  if (program.parentScope.stayMode === "day") return matching.find((option) => option.adultCount === 0) ?? null
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
    ["regionImportance", "지역 중요도 확인"], ["koreanSupportNeed", "한국어 지원 수준 확인"],
    ["parentStayGoals", "부모 체류 목적 확인"],
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
    .map((key) => ({ key, score: programExperienceScore(program, key) * 0.6 + (directions.find((direction) => direction.key === key)?.score ?? 0) * 0.4 }))
    .sort((left, right) => right.score - left.score)[0]?.key ?? "cultureActivity"
}

function programExperienceScore(program: V3CatalogProgram, direction: ExperienceDirectionKey): number {
  return program.experienceAssessment?.directionScores[direction] ?? program.directionSignals[direction]
}

function programExperienceStatus(program: V3CatalogProgram, direction: ExperienceDirectionKey): ExperienceSignalStatus | undefined {
  return program.experienceAssessment?.directionStatuses[direction]
}

function englishReadiness(state: CampfitV3ConversationState): number {
  const value = String(state.facts.childEnglishLevel?.value ?? "unknown")
  return value === "advanced" ? 90 : value === "intermediate" ? 72 : value === "basic" ? 48 : value === "beginner" ? 32 : 50
}

function strengthScore(value: ExperienceGoalStrength): number {
  return value === "primary" ? 100 : value === "secondary" ? 72 : value === "mentioned" ? 42 : 20
}

function selectDiverseProgramCandidates(programs: readonly ScoredProgram[], limit: number): readonly ScoredProgram[] {
  const selected: ScoredProgram[] = []
  const selectedCities = new Set<string>()
  for (const item of programs) {
    const key = cityKey(item.program.city, item.program.country)
    if (selectedCities.has(key)) continue
    selected.push(item)
    selectedCities.add(key)
    if (selected.length >= limit) return selected
  }
  for (const item of programs) {
    if (selected.some((selectedItem) => selectedItem.program.id === item.program.id)) continue
    selected.push(item)
    if (selected.length >= limit) break
  }
  return selected
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

function cityPriorityText(state: CampfitV3ConversationState): string {
  return ["worries", "preferredActivities", "desiredOutcomes", "parentStayGoals", "destinationPreference"]
    .flatMap((key) => arrayValue(state.facts[key as keyof CampfitV3ConversationState["facts"]]?.value))
    .join(" ")
    .toLowerCase()
}

function signalScore(level: "low" | "medium" | "high" | "unknown"): number {
  return level === "high" ? 100 : level === "medium" ? 72 : level === "low" ? 35 : 62
}

function cityProfileFit(city: V3CatalogCity, priorities: string): number {
  const profile = city.profile
  if (!profile) return 62
  const wantsMedical = /medical|hospital|health|emergency|\uBCD1\uC6D0|\uC758\uB8CC|\uC751\uAE09/i.test(priorities)
  const wantsSafety = /safety|security|\uCE58\uC548|\uC548\uC804/i.test(priorities)
  const wantsInternational = /international|multicultural|foreigner|racism|\uB2E4\uC778\uC885|\uC678\uAD6D\uC778|\uC778\uC885|\uCC28\uBCC4/i.test(priorities)
  const wantsActivity = /activity|activities|tourism|culture|weekend|\uBCFC\uAC70\uB9AC|\uCCB4\uD5D8|\uAD00\uAD11|\uC8FC\uB9D0/i.test(priorities)
  const wantsNature = /nature|beach|park|outdoor|\uC790\uC5F0|\uD574\uBCC0|\uACF5\uC6D0/i.test(priorities)
  const weights: readonly (readonly [number, number])[] = [
    [signalScore(profile.medicalLevel), wantsMedical ? 0.25 : 0.08],
    [signalScore(profile.safetyLevel), wantsSafety ? 0.25 : 0.08],
    [signalScore(profile.internationality), wantsInternational ? 0.18 : 0.06],
    [signalScore(profile.activityStrength), wantsActivity ? 0.14 : 0.05],
    [signalScore(profile.natureStrength), wantsNature ? 0.14 : 0.05],
  ]
  const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0)
  return weights.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight
}

function cityReason(city: V3CatalogCity, preferred: boolean, priorities: string): string {
  const profile = city.profile
  const parts: string[] = []
  if (/medical|hospital|health|emergency|\uBCD1\uC6D0|\uC758\uB8CC|\uC751\uAE09/i.test(priorities)) parts.push(`응급 의료 접근성 ${profile?.medicalLevel === "high" ? "우수" : "확인이 필요한 편"}`)
  if (/safety|security|\uCE58\uC548|\uC548\uC804/i.test(priorities)) parts.push(`치안 ${profile?.safetyLevel === "high" ? "우선 고려할 만함" : "세부 확인 필요"}`)
  if (/international|multicultural|foreigner|racism|\uB2E4\uC778\uC885|\uC678\uAD6D\uC778|\uC778\uC885|\uCC28\uBCC4/i.test(priorities)) parts.push(`다문화·외국인 친화도 ${profile?.internationality === "high" ? "강점" : "확인 필요"}`)
  if (/activity|activities|tourism|culture|weekend|\uBCFC\uAC70\uB9AC|\uCCB4\uD5D8|\uAD00\uAD11|\uC8FC\uB9D0/i.test(priorities)) parts.push(`퇴근 후·주말 활동 ${profile?.activityStrength === "high" ? "선택지가 넓음" : "확인 필요"}`)
  if (/nature|beach|park|outdoor|\uC790\uC5F0|\uD574\uBCC0|\uACF5\uC6D0/i.test(priorities)) parts.push(`자연·야외 환경 ${profile?.natureStrength === "high" ? "강점" : "확인 필요"}`)
  if (preferred) parts.push("선호 지역 조건과도 맞습니다.")
  return parts.length ? `${city.name}의 도시 프로필을 기준으로 ${parts.join(", ")} 때문에 추천했습니다.` : `${city.name}의 도시 프로필과 체류 비용을 기준으로 추천했습니다.`
}

function legacyCityReason(city: V3CatalogCity, programCount: number, preferred: boolean): string {
  const parts = [`조건을 통과한 부모 체류 호환 프로그램 ${programCount}개가 실제 카탈로그에 있습니다.`]
  if (preferred) parts.push("사용자가 선택한 지역 선호와도 일치합니다.")
  return parts.join(" ")
}

function cityVerify(city: V3CatalogCity, stayGoals: readonly string[]): readonly string[] {
  const items = ["프로그램과 숙소 사이 실제 이동시간"]
  if (city.flightCostKrw === null) items.push("항공료")
  else items.push("항공료의 왕복·출발지·시즌 기준")
  if (city.housingCostMonthlyKrw === null) items.push("단기 가족 숙소 가격")
  else items.push("도심 1BR 월 비용과 실제 단기 가족 숙소의 차이")
  if (stayGoals.includes("remoteWork") && !hasParentStayEvidence(city, "remoteWork")) items.push("인터넷·업무공간 등 원격근무 환경")
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
  if (excludedCount) {
    const categories = exclusionCategories(programs)
    const categoryLabel = categories.length ? categories.join("·") : "확인된 조건"
    items.push(`${excludedCount}개 프로그램은 ${categoryLabel} 하드 조건으로 제외했습니다.`)
  }
  if (missing.length) items.push("아직 확인되지 않은 조건을 보완하면 도시·프로그램 순위가 달라질 수 있어요.")
  return items
}

function exclusionCategories(programs: readonly ScoredProgram[]): readonly string[] {
  const reasons = programs.flatMap((program) => program.excludedReasons)
  const categories: readonly { readonly label: string; readonly matches: (reason: string) => boolean }[] = [
    { label: "연령", matches: (reason) => reason.includes("연령") },
    { label: "일정·기간", matches: (reason) => /(세션|출발|기간|일정)/.test(reason) },
    { label: "부모 체류", matches: (reason) => /(부모|아이 단독|기숙|홈스테이)/.test(reason) },
    { label: "지원", matches: (reason) => /(한국어|특별관리)/.test(reason) },
    { label: "예산", matches: (reason) => reason.includes("프로그램비") },
    { label: "도시", matches: (reason) => reason.includes("도시") },
  ]
  return categories.filter((category) => reasons.some(category.matches)).map((category) => category.label)
}

function directionSignalForScoring(signal: number, status?: ExperienceSignalStatus): number {
  if (status === "unknown") return 35
  return signal <= 15 ? 50 : signal
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
