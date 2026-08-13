import {
  isoToday,
  parseDepartureRange,
  rangesOverlap,
} from "@/lib/campfit/v3/catalogPolicy"
import type { ExperienceSignalStatus, V3ParentStayPreferences } from "@/lib/campfit/v3/catalogPolicy"
import { activityCategoryPhrase, isActivityPreferenceProfileValue } from "@/lib/campfit/v3/activityPreferences"
import type { ExperienceTag } from "@/lib/campfit/v3/catalogPolicy"
import { assessEnglishReadiness } from "@/lib/campfit/v3/englishReadiness"
import { assessEnglishRequirementMatch, type EnglishRequirementMatch } from "@/lib/campfit/v3/englishRequirement"
import { isParentExperienceNeedsSufficient, isPreferredRegionResolved } from "@/lib/campfit/v3/progress"
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
  readonly englishMatch: EnglishRequirementMatch
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

  // Keep hard-excluded programs out of both candidate selection and fallback.
  // City cost evidence should use the same eligible pool so an excluded row
  // cannot leak back into the result or influence a city's estimate.
  const destinations = scoreDestinations(input.basicInfo, input.state, input.catalog.cities, eligiblePrograms, directions)
  const sortedEligiblePrograms = eligiblePrograms.sort(comparePrograms)
  // City and program recommendations are independent lists. A strong program
  // in a city outside the city Top3 must still be eligible for the program Top3.
  let programCandidates = selectDiverseProgramCandidates(sortedEligiblePrograms, 3)
    .map((item) => toProgramCandidate(item, input.basicInfo, input.state))

  if (destinations.length > 0 && destinations[0]) {
    const firstCityName = destinations[0].cityName.trim().toLowerCase()
    const hasFirstCityProgram = programCandidates.some((c) => c.cityName.trim().toLowerCase() === firstCityName)
    if (!hasFirstCityProgram) {
      const fallbackProgram = eligiblePrograms.find((item) => item.program.city.trim().toLowerCase() === firstCityName)
      if (fallbackProgram) {
        const fallbackCandidate = toProgramCandidate(fallbackProgram, input.basicInfo, input.state)
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
  const primaryDirection = summaryDirectionForState(directions, input.state)
  return {
    consultingConclusion: primaryDirection
      ? buildConsultingConclusion(primaryDirection, input.state)
      : "현재 확인한 가족 조건과 부모 체류 범위를 기준으로 비교 가능한 후보를 정리했어요.",
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
  const commuteNeed = String(input.state.facts.programCommuteNeed?.value ?? "any")
  const childLevel = String(input.state.facts.childEnglishLevel?.value ?? "unknown")
  const readinessAssessment = assessEnglishReadiness(input.state)
  const readiness = readinessAssessment.readiness
  const hasDetailedEnglishEvidence = readinessAssessment.evidenceKeys.length > 0
  const englishMatch = assessEnglishRequirementMatch(readiness, input.program.englishRequirement)
  const activityFitAdjustment = activityPreferenceFitAdjustment(input.program, input.state)
  const commuteFitAdjustment = commuteNeed === "shuttle_preferred"
    ? input.program.shuttleAvailable === true ? 8 : input.program.shuttleAvailable === false ? -8 : 0
    : 0
  if (englishMatch.status === "official_requirement_mismatch") excluded.push("공식 영어 자격조건 미충족 가능성")

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

  if (childLevel === "beginner" || hasDetailedEnglishEvidence && (readiness === "support_required" || readiness === "beginner_friendly")) {
    if (input.program.beginnerClass === false) softMismatch.push("초급자 전용 반 미확인")
    if (input.program.beginnerClass !== true) verify.push("영어 초급자 반·초기 적응 지원")
  }
  verify.push(...englishMatch.verification)
  if (input.state.facts.isFirstOverseasEducationExperience?.value === true && input.program.earlyAdaptationSupport !== true) {
    verify.push("첫 해외 교육 경험을 위한 초기 적응 지원")
  }
  if (communication === "daily" && input.program.dailyParentReport !== true) verify.push("부모에게 전달되는 활동 소식의 빈도")
  if (commuteNeed === "shuttle_preferred" && input.program.shuttleAvailable !== true) verify.push("셔틀·차량 이동 제공 여부")

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
  const beginnerFit = childLevel === "beginner" || hasDetailedEnglishEvidence && (readiness === "support_required" || readiness === "beginner_friendly")
    ? input.program.beginnerClass === true ? 100 : input.program.beginnerClass === false ? 30 : 55
    : 75
  const supportFit = supportScore(koreanNeed, input.program)
  const budgetFit = referenceMinimumKrw === null ? 58 : referenceMinimumKrw <= input.basicInfo.budgetMaxKrw ? 90 : 25
  const score = clamp(goalFit * 0.46 + beginnerFit * 0.14 + supportFit * 0.14 + budgetFit * 0.14 + 60 * 0.07 + metadataScore(input.program) * 0.05 + englishMatch.scoreAdjustment + activityFitAdjustment + commuteFitAdjustment)
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
    englishMatch,
  }
}

function buildConsultingConclusion(
  direction: CampfitV3ExperienceDirection,
  state: CampfitV3ConversationState,
): string {
  const need = primaryParentNeed(state)
  const assessment = assessEnglishReadiness(state)
  const activity = activitySummary(state)
  const region = regionSummary(state)
  const facts: string[] = []

  if (need) {
    facts.push(need.importance === "primary"
      ? `${need.label}을 가장 중요하게 보고 계시고`
      : `${need.label}을 중요한 기준으로 보고 계시고`)
  }
  if (assessment.recommendationSufficiency && assessment.evidenceKeys.includes("childEnglishListening") && assessment.evidenceKeys.includes("childEnglishSpeaking")) {
    facts.push("영어로 진행되는 설명을 이해하고 질문에 답할 수 있는 준비도")
  }
  if (activity) facts.push(`${activity} 선호`)
  if (region) facts.push(`${region} 조건`)

  const groundedSummary = facts.length > 0
    ? `${facts.join(", ")}까지 함께 살펴봤어요.`
    : "상담에서 확인한 가족 조건을 함께 반영했어요."
  return `${groundedSummary} 그래서 ${experienceDirectionSummary(direction, state)} 후보를 비교했어요.`
}

function activitySummary(state: CampfitV3ConversationState): string | null {
  const value = state.facts.activityPreferences?.value
  if (!isActivityPreferenceProfileValue(value)) return null
  const preferred = value.preferences
    .filter((item) => item.strength !== "dislike")
    .sort((left, right) => (left.rank ?? 99) - (right.rank ?? 99))
  if (preferred[0]) return activityCategoryPhrase(preferred[0].category).replace(/ 활동$/u, "")
  return value.varietyPreference === "positive" ? "다양한 활동" : null
}

function regionSummary(state: CampfitV3ConversationState): string | null {
  const value = arrayValue(state.facts.preferredRegions?.value)
  const labels: Readonly<Record<string, string>> = {
    oceania: "오세아니아",
    southeast_asia: "동남아시아",
    north_america: "북미",
    europe: "유럽",
    east_asia: "동아시아",
    middle_east: "중동",
  }
  const resolved = value.map((item) => labels[item] ?? item).filter(Boolean)
  return resolved.length > 0 ? resolved.slice(0, 2).join("·") : null
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
    if (cityBudgetAssessment(city, cityCostProgram, basicInfo).status === "hard_over") return []
    const costFit = cityBudgetFit(city, cityCostProgram, basicInfo)
    const parentFit = parentStayFit(city, stayGoals)
    const profileFit = cityProfileFit(city, priorities)
    return [{ city, balance: regionFit * 0.12 + costFit * 0.18 + parentFit * 0.18 + profileFit * 0.52 }]
  })
  const selected = [...scored].sort((a, b) => b.balance - a.balance).slice(0, 3)
  const roles: readonly CampfitV3DestinationRecommendation["role"][] = ["가장 균형 잡힌 선택", "원래 희망을 가장 잘 살리는 선택", "비용·부모 체류 관점의 대안"]
  return selected.map((item, index): CampfitV3DestinationRecommendation => {
    const role = roles[index] ?? "가장 균형 잡힌 선택"
    const cityProgram = programs.find((program) => cityKey(program.program.city, program.program.country) === cityKey(item.city.name, item.city.country))?.program ?? null
    return {
      cityId: item.city.id,
      cityName: item.city.name,
      citySlug: item.city.slug,
      countryName: item.city.country,
      role,
      imageUrl: item.city.imageUrl,
      reason: cityReason(item.city, preferred.includes(item.city.regionGroup), priorities, state),
      verify: cityVerify(item.city, stayGoals, cityProgram, basicInfo),
      costEstimate: estimateCityCost(item.city, cityProgram, basicInfo),
      cityStayFlightCostKrw: cityStayFlightCost(item.city, basicInfo),
      cityStayMonthlyCostKrw: cityStayMonthlyCost(item.city, basicInfo),
      singleFlightCostKrw: item.city.flightCostKrw,
      livingCostMonthlyKrw: item.city.livingCostMonthlyKrw,
      housingCostMonthlyKrw: item.city.housingCostMonthlyKrw,
      description: item.city.description,
      comparisonNote: buildCityComparisonNote(item.city, index, selected[0]?.city ?? null),
      bullets: buildCityWhyBullets(item.city, role, stayGoals, state, basicInfo),
    }
  })
}

function buildCityComparisonNote(city: V3CatalogCity, index: number, topCity: V3CatalogCity | null): string {
  if (index === 0) return "가족 조건과 상담에서 확인한 우선순위를 가장 균형 있게 반영한 1순위 후보예요."
  if (topCity && city.livingCostMonthlyKrw !== null && topCity.livingCostMonthlyKrw !== null
    && city.livingCostMonthlyKrw < topCity.livingCostMonthlyKrw) {
    return `${topCity.name}보다 도시 생활비 참고값이 낮아 비용 부담을 비교하기 좋은 대안이에요.`
  }
  if (topCity && city.profile?.internationality === "high" && topCity.profile?.internationality !== "high") {
    return "도시 프로필에서 국제성이 높게 확인돼 또래·다문화 환경을 비교할 수 있는 대안이에요."
  }
  return "1순위 후보와 다른 도시 환경을 비교해볼 수 있는 대안이에요."
}

function buildCityWhyBullets(
  city: V3CatalogCity,
  role: string,
  stayGoals: readonly string[],
  state: CampfitV3ConversationState,
  basicInfo: CampfitV3BasicInfo,
): readonly string[] {
  const list: string[] = []
  const profile = city.profile
  const primaryNeed = primaryParentNeed(state)
  const goalEvidence = primaryNeed ? cityGoalEvidence(city, primaryNeed.axis) : null
  if (primaryNeed && goalEvidence) {
    list.push(`${primaryNeed.label}을 중요하게 보셔서 ${city.name}의 ${goalEvidence}을 함께 살펴봤어요.`)
  } else if (preferredRegionMatches(city, state)) {
    list.push(`선호하신 지역 조건과 맞고, ${city.name}의 도시 생활환경을 함께 비교했어요.`)
  } else {
    list.push(`${basicInfo.durationWeeks}주 가족 체류를 기준으로 ${city.name}의 실제 도시 프로필과 비용을 비교했어요.`)
  }

  const activityEvidence = cityActivityEvidence(city, state)
  if (activityEvidence) {
    list.push(`아이의 ${activityEvidence.preference} 선호와 ${city.name}의 ${activityEvidence.cityTrait} 환경을 함께 볼 수 있어요.`)
  } else if (stayGoals.some((goal) => hasParentStayEvidence(city, goal))) {
    const stayGoal = stayGoals.find((goal) => hasParentStayEvidence(city, goal))
    list.push(`${stayGoalLabel(stayGoal)}을 고려해 부모 체류 환경도 함께 살펴봤어요.`)
  } else if (profile?.safetyLevel === "high" && profile.medicalLevel === "high") {
    list.push(`${city.name}은 치안과 의료 인프라가 모두 높은 편으로 확인돼 가족 체류 조건을 비교하기 좋아요.`)
  }

  if (city.livingCostMonthlyKrw !== null) {
    list.push("도시 평균 생활비는 가족 구성과 생활 방식에 따라 달라질 수 있는 참고값이에요.")
  }

  if (list.length < 2 && role === "비용·부모 체류 관점의 대안") {
    list.push("원하는 경험과 함께 비용·부모 체류 조건을 조정해 비교할 수 있는 대안이에요.")
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

function toProgramCandidate(item: ScoredProgram, basicInfo: CampfitV3BasicInfo, state: CampfitV3ConversationState): CampfitV3ProgramCandidate {
  const priceLabel = item.exactPrice?.priceValue !== null && item.exactPrice?.priceValue !== undefined && item.exactPrice.priceValue > 0
    ? `${formatNumber(item.exactPrice.priceValue)} ${item.exactPrice.currency ?? "통화 미확인"}${item.exactPrice.adultCount === 0 ? ` · 아이 ${basicInfo.childAges.length}명 프로그램비` : ""}`
    : item.program.budgetMinKrw !== null && item.program.budgetMinKrw > 0
      ? `${formatNumber(item.program.budgetMinKrw)}원부터`
      : "가격 확인 필요"
  const group: CampfitV3ProgramCandidate["group"] = item.classification === "main"
    ? "우선 살펴볼 프로그램"
    : item.classification === "conditional"
      ? "조건 확인 후 살펴볼 프로그램"
      : "함께 비교할 대안"
  const baseUrl = process.env["NEXT_PUBLIC_ANOGRO_SITE_URL"] ?? "https://www.anogro.com"
  const reasonProjection = buildProgramReason(item, basicInfo, state)
  return {
    programId: item.program.id,
    name: item.program.name,
    cityName: item.program.city,
    countryName: item.program.country,
    // Program rows do not always carry a program-specific image. In that case
    // use the catalog city's own image rather than showing one generic UI asset
    // for every program. A real program image always remains the first choice.
    imageUrl: item.program.imageUrl ?? item.city?.imageUrl ?? null,
    ageLabel: item.program.ageMin !== null && item.program.ageMax !== null ? `만 ${item.program.ageMin}~${item.program.ageMax}세` : "연령 확인 필요",
    durationLabel: item.program.durationWeeks.length ? `${item.program.durationWeeks.join("·")}주 옵션` : "기간 확인 필요",
    priceLabel,
    description: compactProgramDescription(item.program.description),
    primaryDirection: directionLabels[item.direction],
    reason: reasonProjection.reason,
    matchHighlights: reasonProjection.highlights,
    tradeoff: reasonProjection.tradeoff ?? undefined,
    englishRequirementLevel: item.program.englishRequirement?.level ?? "unknown",
    englishRequirementSource: item.program.englishRequirement?.source ?? "unknown",
    englishMatchStatus: item.englishMatch.status,
    englishMatchLabel: item.englishMatch.label,
    englishMatchExplanation: item.englishMatch.explanation,
    verify: item.verify.length ? item.verify : ["최신 일정과 실제 수업 구성"],
    detailUrl: item.program.slug ? `${baseUrl}/program/${encodeURIComponent(item.program.slug)}` : null,
    group,
    score: item.score,
  }
}

function compactProgramDescription(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/gu, " ").trim() ?? ""
  if (!normalized) return null
  const firstSentence = normalized.split(/(?<=[.!?。！？])\s+/u)[0]?.trim() ?? normalized
  return firstSentence.length > 96 ? `${firstSentence.slice(0, 93).trimEnd()}…` : firstSentence
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
    label: "체류 비용 참고",
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
  const readinessAssessment = assessEnglishReadiness(state)
  const readiness = readinessAssessment.readiness
  if (readinessAssessment.evidenceKeys.length > 0 && readiness === "support_required") items.push("영어 지원 담당자와 초급자 반·초기 적응 지원")
  else if (readinessAssessment.evidenceKeys.length > 0 && readiness === "beginner_friendly") items.push("쉬운 영어 안내와 초반 적응 지원")
  else if (String(state.facts.childEnglishLevel?.value ?? "") === "beginner") items.push("영어 초급자 적응 지원")
  const care = String(state.facts.specialCareFollowUp?.value ?? "unknown")
  if (care !== "none") items.push("특별 식사 대응 확인", "복약 지원 확인", "건강·생활 지원 조건 확인")
  return items.length ? items : ["프로그램별 응급 연락 절차 확인"]
}

function requiredFactLabels(state: CampfitV3ConversationState): readonly string[] {
  const labels: string[] = []
  if (!isParentExperienceNeedsSufficient(state)) labels.push("주요 경험 목표 확인")
  if (!assessEnglishReadiness(state).recommendationSufficiency) labels.push("아이 영어 준비도 확인")
  const activity = state.facts.activityPreferences
  if (activity === undefined) labels.push("아이 활동 선호 확인")
  if (!isPreferredRegionResolved(state)) labels.push("희망 지역 확인")
  return labels
}

function activityPreferenceFitAdjustment(program: V3CatalogProgram, state: CampfitV3ConversationState): number {
  const value = state.facts.activityPreferences?.value
  if (!isActivityPreferenceProfileValue(value) || value.preferences.length === 0) return 0
  const signals = new Map(program.experienceAssessment?.tags.map((item) => [item.tag, item.score]) ?? [])
  let adjustment = 0
  for (const preference of value.preferences) {
    const categoryTags = activityCategoryTags[preference.category] ?? []
    if (categoryTags.length === 0) continue
    const evidenceScore = Math.max(...categoryTags.map((tag) => signals.get(tag) ?? 50))
    if (evidenceScore === 50) continue
    if (preference.strength === "dislike") {
      adjustment -= Math.min(5, Math.max(0, evidenceScore - 60) * 0.08)
    } else {
      const weight = preference.strength === "strong" ? 0.1 : 0.06
      adjustment += Math.min(5, (evidenceScore - 50) * weight)
    }
  }
  return adjustment
}

const activityCategoryTags: Readonly<Record<string, readonly ExperienceTag[]>> = {
  stem_maker: ["stem", "science", "technology", "coding", "robotics", "maker", "design", "creative_project", "problem_solving"],
  sports_physical: ["sports"],
  nature_outdoor: ["nature", "environment", "outdoor"],
  animals_ecology: ["nature", "environment"],
  art_creative: ["arts", "design", "creative_project"],
  performance_music: ["arts", "performance"],
  culture_lifestyle: ["culture", "local_experience"],
}

function readGoalStrengths(state: CampfitV3ConversationState): Readonly<Record<ExperienceDirectionKey, ExperienceGoalStrength>> {
  const value = state.facts.experienceGoals?.value
  const record = typeof value === "object" && value !== null ? value as Partial<Record<ExperienceDirectionKey, ExperienceGoalStrength>> : {}
  const parentNeeds = state.facts.parentExperienceNeeds?.value
  const needRecord = typeof parentNeeds === "object" && parentNeeds !== null && !Array.isArray(parentNeeds)
    ? parentNeeds as Record<string, unknown>
    : null
  const parentCulture = strongestGoalStrength([
    needRecord ? parentNeedGoalStrength(needRecord["peer_interaction"]) : "none",
    needRecord ? parentNeedGoalStrength(needRecord["global_experience"]) : "none",
    needRecord ? parentNeedGoalStrength(needRecord["independence_confidence"]) : "none",
  ])
  const parentSchool = needRecord ? parentNeedGoalStrength(needRecord["school_learning_experience"]) : "none"
  const parentEnglish = needRecord ? parentNeedGoalStrength(needRecord["english_growth"]) : "none"
  const hasExplicitParentNeed = needRecord !== null && Object.values(needRecord).some((value) => parentNeedGoalStrength(value) !== "none")
  return {
    schoolSchooling: parentSchool !== "none" ? parentSchool : record.schoolSchooling ?? "none",
    englishIntensive: parentEnglish !== "none" ? parentEnglish : hasExplicitParentNeed ? "none" : record.englishIntensive ?? "none",
    subjectProject: record.subjectProject ?? "none",
    cultureActivity: parentCulture !== "none" ? parentCulture : record.cultureActivity ?? "none",
  }
}

function parentNeedGoalStrength(value: unknown): ExperienceGoalStrength {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "none"
  const importance = (value as Record<string, unknown>)["importance"]
  if (importance === "primary") return "primary"
  if (importance === "important") return "secondary"
  if (importance === "nice_to_have") return "mentioned"
  return "none"
}

function strongestGoalStrength(values: readonly ExperienceGoalStrength[]): ExperienceGoalStrength {
  const rank: Readonly<Record<ExperienceGoalStrength, number>> = { primary: 4, secondary: 3, mentioned: 2, none: 1 }
  return values.reduce((best, value) => rank[value] > rank[best] ? value : best, "none")
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
  const value = assessEnglishReadiness(state).readiness
  return value === "academic_ready" ? 90 : value === "general_program_ready" ? 72 : value === "beginner_friendly" ? 48 : value === "support_required" ? 32 : 50
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

function cityReason(city: V3CatalogCity, preferred: boolean, priorities: string, state: CampfitV3ConversationState): string {
  const profile = city.profile
  const parts: string[] = []
  const need = primaryParentNeed(state)
  const goalEvidence = need ? cityGoalEvidence(city, need.axis) : null
  if (need && goalEvidence) parts.push(`${parentNeedSubject(need)} ${needImportancePhrase(need.importance)} ${city.name}의 ${goalEvidence}을 함께 비교했습니다.`)
  if (/medical|hospital|health|emergency|\uBCD1\uC6D0|\uC758\uB8CC|\uC751\uAE09/i.test(priorities)) parts.push(`응급 의료 접근성 ${profile?.medicalLevel === "high" ? "우수" : "확인이 필요한 편"}`)
  if (/safety|security|\uCE58\uC548|\uC548\uC804/i.test(priorities)) parts.push(`치안 ${profile?.safetyLevel === "high" ? "우선 고려할 만함" : "세부 확인 필요"}`)
  if (/international|multicultural|foreigner|racism|\uB2E4\uC778\uC885|\uC678\uAD6D\uC778|\uC778\uC885|\uCC28\uBCC4/i.test(priorities)) parts.push(`다문화·외국인 친화도 ${profile?.internationality === "high" ? "강점" : "확인 필요"}`)
  if (/activity|activities|tourism|culture|weekend|\uBCFC\uAC70\uB9AC|\uCCB4\uD5D8|\uAD00\uAD11|\uC8FC\uB9D0/i.test(priorities)) parts.push(`퇴근 후·주말 활동 ${profile?.activityStrength === "high" ? "선택지가 넓음" : "확인 필요"}`)
  if (/nature|beach|park|outdoor|\uC790\uC5F0|\uD574\uBCC0|\uACF5\uC6D0/i.test(priorities)) parts.push(`자연·야외 환경 ${profile?.natureStrength === "high" ? "강점" : "확인 필요"}`)
  if (preferred) parts.push("선호 지역 조건과도 맞습니다.")
  if (parts.length === 0) return `${city.name}의 도시 프로필과 가족 체류 비용 참고값을 기준으로 비교했습니다.`
  return `${city.name}은 ${parts.join(", ")}`
}

function preferredRegionMatches(city: V3CatalogCity | null, state: CampfitV3ConversationState): boolean {
  if (city === null) return false
  const preferred = arrayValue(state.facts.preferredRegions?.value)
  return preferred.length > 0 && preferred.includes(city.regionGroup)
}

function cityGoalEvidence(city: V3CatalogCity, axis: ParentNeedProjection["axis"]): string | null {
  const profile = city.profile
  const evidence = city.parentStayEvidence ?? ""
  if (axis === "peer_interaction" && (profile?.internationality === "high" || /international|multicultural|community|다문화|외국인|국제/i.test(evidence))) return "다문화·국제 교류 환경"
  if (axis === "global_experience" && (profile?.activityStrength === "high" || /culture|tour|local|문화|관광|현지/i.test(evidence))) return "현지 문화·도시 체험 환경"
  if (axis === "independence_confidence" && profile?.safetyLevel === "high") return "확인된 치안 프로필"
  return null
}

function cityActivityEvidence(city: V3CatalogCity, state: CampfitV3ConversationState): { readonly preference: string; readonly cityTrait: string } | null {
  const value = state.facts.activityPreferences?.value
  if (!isActivityPreferenceProfileValue(value)) return null
  const profile = city.profile
  if (!profile) return null
  for (const preference of value.preferences.filter((item) => item.strength !== "dislike")) {
    if (preference.category === "nature_outdoor" && profile.natureStrength === "high") return { preference: activityCategoryPhrase(preference.category), cityTrait: "자연·야외" }
    if ((preference.category === "sports_physical" || preference.category === "culture_lifestyle") && profile.activityStrength === "high") return { preference: activityCategoryPhrase(preference.category), cityTrait: "활동·도시 체험" }
  }
  return null
}

function stayGoalLabel(goal: string | undefined): string {
  if (goal === "restWellness") return "휴식·웰니스"
  if (goal === "remoteWork") return "원격근무"
  if (goal === "cafeDining") return "현지 생활·카페"
  if (goal === "tourismCulture") return "관광·문화"
  if (goal === "natureBeach") return "자연·해변"
  return "부모 체류 목적"
}

function legacyCityReason(city: V3CatalogCity, programCount: number, preferred: boolean): string {
  const parts = [`조건을 통과한 부모 체류 호환 프로그램 ${programCount}개가 실제 카탈로그에 있습니다.`]
  if (preferred) parts.push("사용자가 선택한 지역 선호와도 일치합니다.")
  return parts.join(" ")
}

function cityVerify(city: V3CatalogCity, stayGoals: readonly string[], program: V3CatalogProgram | null, basicInfo: CampfitV3BasicInfo): readonly string[] {
  const items = ["프로그램과 숙소 사이 실제 이동시간"]
  if (city.flightCostKrw === null) items.push("항공료")
  else items.push("항공료의 왕복·출발지·시즌 기준")
  if (city.housingCostMonthlyKrw === null) items.push("단기 가족 숙소 가격")
  else items.push("도심 1BR 월 비용과 실제 단기 가족 숙소의 차이")
  if (cityBudgetAssessment(city, program, basicInfo).status === "soft_over") items.push("예산 상한 대비 체류 비용 부담 가능성")
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
  const ratio = cityBudgetAssessment(city, program, basicInfo).ratio
  if (ratio === null || basicInfo.budgetMaxKrw <= 0) return 60
  return ratio <= 0.85 ? 92 : ratio <= 1.1 ? 72 : ratio <= 1.35 ? 52 : 35
}

type CityBudgetAssessment = {
  readonly status: "unknown" | "within_budget" | "soft_over" | "hard_over"
  readonly ratio: number | null
}

function cityBudgetAssessment(city: V3CatalogCity, program: V3CatalogProgram | null, basicInfo: CampfitV3BasicInfo): CityBudgetAssessment {
  const estimate = estimateCityCost(city, program, basicInfo)
  if (estimate.estimatedTotalMinKrw === null || basicInfo.budgetMaxKrw <= 0) return { status: "unknown", ratio: null }
  const ratio = estimate.estimatedTotalMinKrw / basicInfo.budgetMaxKrw
  // Keep modest overages as ranked alternatives with an explicit warning.
  // Exclude only when the minimum reference total is more than 50% over the
  // budget ceiling; this is a practical guard, not an exact-budget filter.
  return {
    status: ratio > 1.5 ? "hard_over" : ratio > 1 ? "soft_over" : "within_budget",
    ratio,
  }
}

type ProgramReasonProjection = {
  readonly reason: string
  readonly highlights: readonly string[]
  readonly tradeoff: string | null
}

type ParentNeedProjection = {
  readonly axis: "english_growth" | "peer_interaction" | "global_experience" | "independence_confidence" | "school_learning_experience"
  readonly label: string
  readonly importance: "primary" | "important" | "nice_to_have"
}

const parentNeedLabels: Readonly<Record<ParentNeedProjection["axis"], string>> = {
  english_growth: "영어를 실제로 사용하며 자연스럽게 늘리는 경험",
  peer_interaction: "외국 친구들과 어울리는 경험",
  global_experience: "새로운 문화와 환경을 경험하는 것",
  independence_confidence: "새로운 환경에서 스스로 해내며 자신감을 키우는 것",
  school_learning_experience: "해외 학교생활과 수업 방식을 경험하는 것",
}

function buildProgramReason(item: ScoredProgram, basicInfo: CampfitV3BasicInfo, state: CampfitV3ConversationState): ProgramReasonProjection {
  const need = primaryParentNeed(state)
  const goalEvidence = need ? programGoalEvidence(item.program, need.axis, item.direction) : null
  const activityMatch = programActivityMatch(item.program, state)
  const highlights: string[] = []
  const lead = need
    ? goalEvidence
      ? `${parentNeedSubject(need)} ${needImportancePhrase(need.importance)} 프로그램의 ${goalEvidence} 정보와 잘 맞는 후보예요.`
      : activityMatch
        ? `${activityMatch.preference}과 프로그램의 ${activityMatch.programFeature} 구성이 잘 맞아 추천했어요. ${need.label}은 프로그램 정보에서 추가 확인이 필요해요.`
        : `${parentNeedSubject(need)} ${needImportancePhrase(need.importance, true)} 이 후보에서 목표와 직접 연결되는 프로그램 특성은 추가 확인이 필요해요.`
    : `${directionLabels[item.direction]}을 중심으로 아이의 연령·${basicInfo.durationWeeks}주 기간·가족 체류 조건을 함께 확인한 후보예요.`

  const activityInLead = need !== null && goalEvidence === null && activityMatch !== null
  if (activityMatch && !activityInLead) {
    highlights.push(`아이가 좋아하는 ${activityMatch.preference}과 프로그램의 ${activityMatch.programFeature} 구성이 연결돼요.`)
  }

  const participationHighlight = programParticipationHighlight(item.program, state)
  if (participationHighlight) highlights.push(participationHighlight)

  if (preferredRegionMatches(item.city, state)) highlights.push("말씀하신 선호 지역 조건과도 맞아요.")

  let tradeoff: string | null = null
  if (item.classification === "alternative" && need === null) {
    tradeoff = "가족의 핵심 목표와 일부 조건이 달라, 확인할 점이 있는 대안으로 표시했어요."
  }

  return { reason: lead, highlights: highlights.slice(0, 3), tradeoff }
}

function primaryParentNeed(state: CampfitV3ConversationState): ParentNeedProjection | null {
  const value = state.facts.parentExperienceNeeds?.value
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const axes: readonly ParentNeedProjection["axis"][] = ["school_learning_experience", "english_growth", "peer_interaction", "global_experience", "independence_confidence"]
  const importanceOrder: readonly ParentNeedProjection["importance"][] = ["primary", "important", "nice_to_have"]
  for (const importance of importanceOrder) {
    const axis = axes.find((key) => {
      const need = record[key]
      return typeof need === "object" && need !== null && (need as Record<string, unknown>)["importance"] === importance
        && Array.isArray((need as Record<string, unknown>)["evidence"])
        && ((need as Record<string, unknown>)["evidence"] as unknown[]).length > 0
    })
    if (axis) return { axis, label: parentNeedLabels[axis], importance }
  }
  return null
}

function experienceDirectionSummary(
  direction: CampfitV3ExperienceDirection,
  state: CampfitV3ConversationState,
): string {
  const need = primaryParentNeed(state)
  if (direction.key === "cultureActivity" && need?.axis === "peer_interaction") return "또래 교류 중심의 문화·활동 경험"
  if (direction.key === "cultureActivity" && need?.axis === "global_experience") return "새로운 문화·환경 중심의 문화·활동 경험"
  if (direction.key === "cultureActivity" && need?.axis === "independence_confidence") return "자립·적응 중심의 문화·활동 경험"
  return direction.label
}

function summaryDirectionForState(
  directions: readonly CampfitV3ExperienceDirection[],
  state: CampfitV3ConversationState,
): CampfitV3ExperienceDirection | undefined {
  const parentNeed = primaryParentNeed(state)
  const parentDirection = parentNeed?.axis === "english_growth"
    ? "englishIntensive"
    : parentNeed?.axis === "school_learning_experience"
      ? "schoolSchooling"
      : parentNeed === null
        ? null
        : "cultureActivity"
  if (parentDirection !== null) return directions.find((direction) => direction.key === parentDirection) ?? directions[0]

  const goals = state.facts.experienceGoals?.value
  if (typeof goals === "object" && goals !== null && !Array.isArray(goals)) {
    const record = goals as Record<string, unknown>
    const legacyPrimary = (["schoolSchooling", "englishIntensive", "subjectProject", "cultureActivity"] as const)
      .find((key) => record[key] === "primary")
    if (legacyPrimary !== undefined) return directions.find((direction) => direction.key === legacyPrimary) ?? directions[0]
  }
  return directions[0]
}

function needImportancePhrase(importance: ParentNeedProjection["importance"], contrast = false): string {
  if (importance === "primary") return "가장 중요하게 보고 계셔서"
  if (importance === "important") return "중요하게 보고 계셔서"
  return contrast ? "함께 기대하고 계시지만," : "함께 기대하고 계셔서"
}

function parentNeedSubject(need: ParentNeedProjection): string {
  return need.importance === "nice_to_have" ? `${need.label}도` : `${need.label}을`
}

function programGoalEvidence(program: V3CatalogProgram, axis: ParentNeedProjection["axis"], direction: ExperienceDirectionKey): string | null {
  const text = catalogProgramEvidenceText(program)
  const directionScore = programExperienceScore(program, direction)
  if (axis === "peer_interaction" && /또래|친구|교류|국제학생|다국적|다문화|international|multicultural|collaboration|community/i.test(text)) return "또래 교류·협업 활동"
  const englishLevel = program.englishRequirement?.level
  if (axis === "english_growth" && ((englishLevel !== undefined && englishLevel !== "unknown" && englishLevel !== "no_requirement") || directionScore >= 60 || /영어|english|esl|immersion|language/i.test(text))) return "영어 사용 활동"
  if (axis === "global_experience" && /문화|현지|도시|다문화|국제|culture|local|international|community/i.test(text)) return "현지 문화·다문화 활동"
  if (axis === "independence_confidence" && (program.parentScope.stayMode === "child_residential" || program.parentScope.stayMode === "homestay" || program.earlyAdaptationSupport === true)) return "아이 독립 참여·초기 적응 지원"
  if (axis === "school_learning_experience" && (direction === "schoolSchooling" || /학교|수업|school|class|schooling/i.test(text))) return "학교형 수업 환경"
  return null
}

function programActivityMatch(program: V3CatalogProgram, state: CampfitV3ConversationState): { readonly preference: string; readonly programFeature: string } | null {
  const value = state.facts.activityPreferences?.value
  if (!isActivityPreferenceProfileValue(value)) return null
  // Activity claims should come from the program's own normalized traits or
  // tag evidence. Broad marketing strengths may mention several directions
  // and are not precise enough to claim a child-preference match on their own.
  const evidenceText = programActivityEvidenceText(program)
  const signals = new Map(program.experienceAssessment?.tags.map((item) => [item.tag, item.score]) ?? [])
  const ordered = [...value.preferences].filter((preference) => preference.strength !== "dislike").sort((left, right) => (left.rank ?? 99) - (right.rank ?? 99))
  for (const preference of ordered) {
    const tags = activityCategoryTags[preference.category] ?? []
    const signal = Math.max(...tags.map((tag) => signals.get(tag) ?? 0), 0)
    const textMatches = activityTextMatches(preference.category, evidenceText)
    if (signal < 65 && !textMatches) continue
    return {
      preference: activityCategoryPhrase(preference.category),
      programFeature: programTraitForActivity(program, preference.category) ?? activityCategoryPhrase(preference.category),
    }
  }
  return null
}

function programParticipationHighlight(program: V3CatalogProgram, state: CampfitV3ConversationState): string | null {
  const profile = state.facts.participationProfile?.value
  if (typeof profile !== "object" || profile === null || Array.isArray(profile)) return null
  const adaptation = (profile as Record<string, unknown>)["adaptation_to_new_environment"]
  const level = typeof adaptation === "object" && adaptation !== null ? (adaptation as Record<string, unknown>)["level"] : null
  if (level === "warm_up_needed" && program.earlyAdaptationSupport === true) return "처음 적응 시간이 필요한 아이를 위해 초반 적응 지원이 확인돼요."
  if (level === "quick_to_adapt" && program.parentScope.stayMode === "day") return "새로운 일정에 빠르게 참여하는 아이가 낮 프로그램으로 경험하기 좋은 구조예요."
  return null
}

function catalogProgramEvidenceText(program: V3CatalogProgram): string {
  return [
    program.description ?? "",
    ...program.traits,
    ...(program.demoProfile?.strengths ?? []),
    ...(program.experienceAssessment?.evidence.flatMap((item) => [item.value, ...item.tags]) ?? []),
  ].join(" ")
}

function programActivityEvidenceText(program: V3CatalogProgram): string {
  return [
    program.description ?? "",
    ...program.traits,
    ...(program.experienceAssessment?.tags.map((item) => item.tag) ?? []),
  ].join(" ")
}

function activityTextMatches(category: string, text: string): boolean {
  const patterns: Readonly<Record<string, RegExp>> = {
    stem_maker: /stem|science|coding|robot|maker|과학|실험|코딩|로봇|메이커|만들기/i,
    sports_physical: /sport|축구|농구|수영|운동|체육/i,
    nature_outdoor: /nature|outdoor|environment|자연|야외|숲|해양|바다|환경/i,
    animals_ecology: /animal|ecology|wildlife|동물|생태|해양생물/i,
    art_creative: /art|drawing|painting|craft|design|미술|그림|공예|디자인/i,
    performance_music: /music|performance|dance|concert|음악|공연|춤|댄스/i,
    culture_lifestyle: /culture|local|city|문화|현지|도시/i,
  }
  return patterns[category]?.test(text) ?? false
}

function programTraitForActivity(program: V3CatalogProgram, category: string): string | null {
  const patterns: Readonly<Record<string, RegExp>> = {
    stem_maker: /STEM|science|coding|robot|maker|과학|실험|코딩|로봇|메이커|만들기/i,
    sports_physical: /sport|축구|농구|수영|운동|체육/i,
    nature_outdoor: /nature|outdoor|environment|자연|야외|숲|해양|바다|환경/i,
    animals_ecology: /animal|ecology|wildlife|동물|생태|해양생물/i,
    art_creative: /art|drawing|painting|craft|design|미술|그림|공예|디자인/i,
    performance_music: /music|performance|dance|concert|음악|공연|춤|댄스/i,
    culture_lifestyle: /culture|local|city|문화|현지|도시/i,
  }
  return program.traits.find((trait) => patterns[category]?.test(trait)) ?? null
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
