import { numberValue, parentAccompanimentMode, preferredProgramTypes, stringArrayValue } from "@/lib/campfit/v2/profileAccess"
import { programModeProfiles } from "@/lib/campfit/v2/programModeProfiles"
import type { ConsultingProfile, ProgramModeFitProfile, ProgramModeKey, ProgramModeRecommendation, ProgramModeScoreBreakdown, RecommendationTier } from "@/types/campfitV2"

type ProgramModeAdvisorOptions = {
  readonly limit?: number
}

type ModeConflict = {
  readonly severity: "critical" | "major" | "caution"
  readonly message: string
}

export function buildProgramModeRecommendations(
  profile: ConsultingProfile,
  options: ProgramModeAdvisorOptions = {},
): readonly ProgramModeRecommendation[] {
  const limit = Math.max(3, options.limit ?? 3)
  return programModeProfiles
    .map((mode) => scoreProgramModeForProfile(profile, mode))
    .sort(compareRecommendations)
    .slice(0, limit)
}

export function scoreProgramModeForProfile(
  profile: ConsultingProfile,
  mode: ProgramModeFitProfile,
): ProgramModeRecommendation {
  const conflicts = buildConflicts(profile, mode)
  const scoreBreakdown = buildScoreBreakdown(profile, mode, conflicts)
  const score = weightedScore(scoreBreakdown)
  const tier = classifyProgramModeTier(score, conflicts)

  return {
    key: mode.modeKey,
    title: mode.title,
    shortTitle: mode.shortTitle,
    description: mode.description,
    score,
    tier,
    fitLabel: buildProgramModeFitLabel(mode, score, conflicts),
    whyFits: buildWhyFits(profile, mode, scoreBreakdown),
    tradeoffs: buildProgramModeTradeoffs(mode, conflicts),
    bestFor: mode.bestFor.slice(0, 2),
    verifyBeforeConsulting: mode.verifyBeforeConsulting.slice(0, 2),
    scoreBreakdown,
    imageKey: mode.imageKey,
    imagePath: mode.imagePath,
    imageAlt: mode.imageAlt,
  }
}

export function classifyProgramModeTier(score: number, conflicts: readonly ModeConflict[]): RecommendationTier {
  if (conflicts.some((conflict) => conflict.severity === "critical")) return "not_recommended"
  if (conflicts.some((conflict) => conflict.severity === "major")) return "possible_if_adjusted"
  if (score >= 82) return "best_fit"
  if (score >= 64) return "good_with_support"
  if (score >= 45) return "possible_if_adjusted"
  return "not_recommended"
}

export function buildProgramModeFitLabel(
  mode: ProgramModeFitProfile,
  score: number,
  conflicts: readonly ModeConflict[],
): string {
  if (conflicts.some((conflict) => conflict.severity === "critical")) return "현재 가족 조건과 구조적으로 맞지 않는 부분이 큽니다."
  if (conflicts.some((conflict) => conflict.severity === "major")) return "핵심 조건을 조정하거나 지원 범위를 확인한 뒤 검토하는 방향입니다."
  if (score >= 82) return `${mode.shortTitle}은 현재 입력 기준에서 우선 검토하기 좋은 방향입니다.`
  if (score >= 64) return "초기 적응과 운영 조건을 확인하면 검토할 수 있는 방향입니다."
  return "현재 조건과의 간격이 있어 상담 전 조정할 점을 먼저 확인하는 방향입니다."
}

export function buildProgramModeTradeoffs(
  mode: ProgramModeFitProfile,
  conflicts: readonly ModeConflict[],
): readonly string[] {
  return uniqueStrings([...conflicts.map((conflict) => conflict.message), ...mode.watchOut]).slice(0, 2)
}

function buildScoreBreakdown(
  profile: ConsultingProfile,
  mode: ProgramModeFitProfile,
  conflicts: readonly ModeConflict[],
): ProgramModeScoreBreakdown {
  return {
    childFit: childFit(profile, mode),
    goalFit: goalFit(profile, mode),
    supportFit: supportFit(profile, mode),
    familyConstraintFit: familyConstraintFit(profile, mode),
    riskFit: riskFit(profile, mode, conflicts),
    budgetRealityFit: budgetRealityFit(profile, mode),
  }
}

function childFit(profile: ConsultingProfile, mode: ProgramModeFitProfile): number {
  const english = mean([readiness(profile, "english_comprehension"), readiness(profile, "english_help_seeking")])
  const transition = readiness(profile, "transition_readiness")
  const independence = readiness(profile, "daily_life_independence")
  const social = mean([readiness(profile, "social_confidence"), readiness(profile, "resilience")])
  return average([
    readinessCompatibility(english, mode.englishExposure),
    readinessCompatibility(transition, mode.parentSeparationLoad),
    readinessCompatibility(independence, mode.independenceRequired),
    readinessCompatibility(social, mode.socialIntensity),
  ])
}

function goalFit(profile: ConsultingProfile, mode: ProgramModeFitProfile): number {
  const goals = uniqueStrings([
    ...stringArrayValue(profile.parentIntent, "primary_goals"),
    ...stringArrayValue(profile.parentIntent, "secondaryGoals"),
    ...stringArrayValue(profile.parentIntent, "parentGoals"),
  ])
  const preferred = preferredProgramTypes(profile)
  const goalScore = goals.length === 0 ? 55 : average(goals.map((goal) => scoreGoal(mode, goal)))
  const preferenceBoost = preferred.includes(mode.modeKey) ? 18 : 0
  return clamp(goalScore + preferenceBoost)
}

function supportFit(profile: ConsultingProfile, mode: ProgramModeFitProfile): number {
  const parentMode = parentAccompanimentMode(profile)
  const koreanSupport = String(profile.hardConstraints["koreanSupportNeed"] ?? "undecided")
  const parentScore = parentMode === "parent_required"
    ? mode.parentAccompanimentFit * 20
    : parentMode === "parent_can_stay"
      ? mode.parentStayPracticality * 20
      : 60
  const koreanScore = koreanSupport === "resident_korean_manager"
    ? mode.koreanSupportCompatibility * 20
    : koreanSupport === "daily_korean_communication"
      ? Math.min(100, (mode.koreanSupportCompatibility * 18) + 10)
      : 65
  return average([parentScore, koreanScore, mode.emotionalSafetyFit * 20])
}

function familyConstraintFit(profile: ConsultingProfile, mode: ProgramModeFitProfile): number {
  const parentMode = parentAccompanimentMode(profile)
  const parentScore = parentMode === "parent_required"
    ? mode.parentAccompanimentFit * 20
    : parentMode === "parent_can_stay"
      ? mode.parentStayPracticality * 20
      : parentMode === "child_solo_or_chaperone_ok"
        ? (mode.parentSeparationLoad * 12) + 40
        : 65
  const minWeeks = numberValue(profile.hardConstraints, "durationWeeksMin")
  const maxWeeks = numberValue(profile.hardConstraints, "durationWeeksMax")
  const durationScore = minWeeks !== undefined && maxWeeks !== undefined && maxWeeks <= 2
    ? mode.durationFlexibility * 20
    : 70
  return average([parentScore, durationScore, mode.routineStability * 20])
}

function riskFit(profile: ConsultingProfile, mode: ProgramModeFitProfile, conflicts: readonly ModeConflict[]): number {
  const penalty = conflicts.reduce((total, conflict) => total + severityPenalty(conflict.severity), 0)
  return clamp(92 - penalty - Math.max(0, mode.parentSeparationLoad - readiness(profile, "transition_readiness")) * 5)
}

function budgetRealityFit(profile: ConsultingProfile, mode: ProgramModeFitProfile): number {
  const budgetMax = profile.budgetEstimates
    .map((estimate) => estimate.availableProgramBudgetKrwMax)
    .filter((value): value is number => value !== undefined)
    .sort((left, right) => right - left)[0]
  if (budgetMax === undefined) return 60
  if (budgetMax < 2_000_000) return clamp(94 - mode.budgetPressure * 13)
  if (budgetMax < 4_000_000) return clamp(98 - mode.budgetPressure * 9)
  return clamp(100 - mode.budgetPressure * 4)
}

function buildConflicts(profile: ConsultingProfile, mode: ProgramModeFitProfile): readonly ModeConflict[] {
  const conflicts: ModeConflict[] = []
  const parentMode = parentAccompanimentMode(profile)
  const koreanSupport = String(profile.hardConstraints["koreanSupportNeed"] ?? "undecided")
  const english = mean([readiness(profile, "english_comprehension"), readiness(profile, "english_help_seeking")])
  const transition = readiness(profile, "transition_readiness")
  const independence = readiness(profile, "daily_life_independence")
  const avoidConditions = stringArrayValue(profile.riskProfile, "avoid_conditions")

  if (parentMode === "parent_required" && mode.parentAccompanimentFit <= 1 && mode.parentSeparationLoad >= 4) {
    conflicts.push({ severity: "critical", message: "부모 동행 필수 조건과 이 방식의 분리 구조가 맞지 않습니다." })
  }
  if (transition <= 2 && mode.parentSeparationLoad >= 5) {
    conflicts.push({ severity: "major", message: "초기 분리 적응 부담이 커서 사전 연습이나 부모동반 대안이 필요합니다." })
  }
  if (independence <= 2 && mode.independenceRequired >= 4 && mode.dailyLifeSupportCoverage <= 3) {
    conflicts.push({ severity: "major", message: "낯선 생활환경에서 필요한 독립성보다 지원 여유가 적을 수 있습니다." })
  }
  if (english <= 2 && mode.academicIntensity >= 5 && mode.beginnerFriendly <= 2) {
    conflicts.push({ severity: "major", message: "영어 수업 참여와 도움 요청 부담을 낮출 지원이 필요합니다." })
  }
  if (koreanSupport === "resident_korean_manager" && mode.koreanSupportCompatibility <= 2) {
    conflicts.push({ severity: "major", message: "상주형 한국어 지원을 기대한다면 실제 운영 범위를 먼저 확인해야 합니다." })
  }
  if (koreanSupport === "daily_korean_communication" && mode.koreanSupportCompatibility <= 2) {
    conflicts.push({ severity: "caution", message: "매일 한국어 소통이 가능한지 운영사별 확인이 필요합니다." })
  }
  if (avoidConditions.includes("high_academic_intensity") && mode.academicIntensity >= 4) {
    conflicts.push({ severity: "major", message: "피하고 싶은 학업 부담과 프로그램 방식이 겹칠 수 있습니다." })
  }
  if (avoidConditions.includes("full_boarding_separation") && mode.parentSeparationLoad >= 5) {
    conflicts.push({ severity: "critical", message: "피하고 싶은 완전 분리형 생활과 이 방식이 겹칩니다." })
  }
  if (avoidConditions.includes("too_little_english") && mode.englishExposure <= 2) {
    conflicts.push({ severity: "major", message: "기대하는 영어 노출량에 비해 활동 비중이 높을 수 있습니다." })
  }
  return conflicts
}

function buildWhyFits(profile: ConsultingProfile, mode: ProgramModeFitProfile, scores: ProgramModeScoreBreakdown): readonly string[] {
  const reasons: string[] = []
  if (preferredProgramTypes(profile).includes(mode.modeKey)) reasons.push("부모님이 직접 선택한 프로그램 방식입니다.")
  if (scores.goalFit >= 75) reasons.push("입력하신 기대와 이 방식의 경험 목표가 비교적 잘 맞습니다.")
  if (scores.childFit >= 72) reasons.push("현재 적응 준비도와 프로그램 부담의 간격이 크지 않습니다.")
  if (scores.supportFit >= 75) reasons.push("부모 동행·한국어 소통·초기 적응 지원 조건과 궁합이 좋습니다.")
  if (reasons.length === 0) reasons.push(mode.bestFor[0] ?? "현재 조건에서 상담으로 비교해볼 수 있는 방식입니다.")
  return reasons.slice(0, 2)
}

function scoreGoal(mode: ProgramModeFitProfile, goal: string): number {
  switch (goal) {
    case "natural_english_exposure": return (mode.englishExposure * 14) + (mode.englishConfidenceFit * 6)
    case "cultural_exposure": return mode.culturalExposureFit === 5 ? 100 : mode.culturalExposureFit * 15
    case "reduce_english_resistance": return average([mode.beginnerFriendly * 20, mode.englishConfidenceFit * 20, mode.emotionalSafetyFit * 20])
    case "english_improvement": return mode.englishImprovementFit * 20
    case "academic_stimulation": return average([mode.academicGrowthFit * 20, mode.academicIntensity * 20])
    case "international_school_exposure": return mode.internationalSchoolExposureFit * 20
    case "independence": return mode.independenceGrowthFit * 20
    case "activity_experience": return mode.activityExperienceFit * 20
    case "study_abroad_trial": return mode.studyAbroadTrialFit * 20
    case "safe_care": return mode.safeCareFit * 20
    default: return 55
  }
}

function readiness(profile: ConsultingProfile, key: string): number {
  return clampRaw(numberValue(profile.childReadiness, key) ?? 3)
}

function readinessCompatibility(readinessScore: number, requirement: number): number {
  const gap = requirement - readinessScore
  if (gap <= 0) return 94
  if (gap === 1) return 73
  if (gap === 2) return 44
  return 18
}

function weightedScore(scores: ProgramModeScoreBreakdown): number {
  return clamp(Math.round(
    (scores.childFit * 0.25) + (scores.goalFit * 0.25) + (scores.supportFit * 0.15) +
    (scores.familyConstraintFit * 0.15) + (scores.riskFit * 0.1) + (scores.budgetRealityFit * 0.1),
  ))
}

function compareRecommendations(left: ProgramModeRecommendation, right: ProgramModeRecommendation): number {
  const tierDifference = tierRank(left.tier) - tierRank(right.tier)
  return tierDifference === 0 ? right.score - left.score : tierDifference
}

function tierRank(tier: RecommendationTier): number {
  switch (tier) {
    case "best_fit": return 0
    case "good_with_support": return 1
    case "possible_if_adjusted": return 2
    case "not_recommended": return 3
  }
}

function severityPenalty(severity: ModeConflict["severity"]): number {
  switch (severity) {
    case "critical": return 52
    case "major": return 28
    case "caution": return 10
  }
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 55 : Math.round(values.reduce((total, value) => total + value, 0) / values.length)
}

function mean(values: readonly number[]): number {
  return average(values)
}

function clampRaw(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)))
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}
