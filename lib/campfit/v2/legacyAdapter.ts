import {
  childAge,
  koreanSupportNeed,
  numberValue,
  parentAccompanimentMode,
  preferredProgramTypes,
  preferredRegions,
  riskSignals,
  stringArrayValue,
} from "@/lib/campfit/v2/profileAccess"
import type { CampReadinessResult, CampfitInput, ParentAnalysis, ProgramType } from "@/types/campfit"
import type { ConsultingProfile } from "@/types/campfitV2"

export type LegacyMatchingPayload = {
  readonly input: CampfitInput
  readonly analysis: ParentAnalysis
  readonly readiness: CampReadinessResult
  readonly warnings: readonly string[]
}

export function buildLegacyParentInputFromV2(profile: ConsultingProfile): CampfitInput {
  const warnings = legacyWarnings(profile)
  return {
    childAge: childAge(profile),
    // Legacy compatibility placeholder only. v2 does not store, expose, or report a school-year field.
    grade: "초2",
    englishSelfLevel: englishSelfLevel(profile),
    overseasExperience: "none",
    shynessLevel: levelFromReadinessScore(numberValue(profile.childReadiness, "social_confidence"), true),
    separationTolerance: levelFromReadinessScore(numberValue(profile.childReadiness, "transition_readiness"), false),
    budgetRange: "over_8m",
    destinationPreference: destinationPreference(profile),
    travelReadiness: preferredRegions(profile).includes("oceania") ? "long_flight_independent" : "moderate_distance",
    durationWeeks: durationWeeks(profile),
    parentAccompanied: parentPreference(profile),
    koreanManagerRequired: koreanManagerPreference(profile),
    preferredProgramType: programTypePreference(profile),
    parentConcernText: warnings.join(" / "),
  }
}

export function buildLegacyParentAnalysisFromV2(profile: ConsultingProfile): ParentAnalysis {
  const risks = riskSignals(profile)
  const goals = stringArrayValue(profile.parentIntent, "parentGoals")
  const safetyPriority = koreanSupportNeed(profile) === "resident_korean_manager" ? 0.9 : 0.62
  const englishReadiness = normalizedScore(numberValue(profile.childReadiness, "english_help_seeking"), 0.42)
  const separation = normalizedScore(numberValue(profile.childReadiness, "transition_readiness"), 0.5)

  return {
    parentType: safetyPriority > 0.8 ? "v2 안전 우선 상담형" : "v2 성장 균형 상담형",
    parentGoal: {
      englishGrowth: goals.includes("english_improvement") ? 0.86 : 0.68,
      confidenceGrowth: goals.includes("confidence") ? 0.82 : 0.65,
      independenceGrowth: goals.includes("independence") ? 0.8 : 0.5,
      socialGrowth: 0.58,
      safetyPriority,
      academicResultPriority: preferredProgramTypes(profile).some((type) => type.includes("school")) ? 0.76 : 0.48,
      experiencePriority: 0.64,
    },
    childProfile: {
      englishReadiness,
      socialConfidence: normalizedScore(numberValue(profile.childReadiness, "social_confidence"), 0.5),
      separationTolerance: separation,
      newEnvironmentAdaptability: normalizedScore(numberValue(profile.childReadiness, "adaptability"), 0.5),
      challengeTolerance: risks.includes("english_overload") ? 0.42 : 0.58,
    },
    supportNeeded: [
      englishReadiness < 0.5 ? "beginner_class" : "buddy_system",
      safetyPriority > 0.8 ? "korean_manager" : "early_adaptation_support",
      separation < 0.5 ? "daily_parent_report" : "small_group_care",
    ],
    detectedTensions: profile.riskProfile["conflicts"] === undefined ? [] : [
      {
        type: "english_growth_vs_anxiety",
        description: "v2 상담 프로필의 조건 충돌을 v1 분석 텐션으로 요약했습니다.",
        confidence: 0.7,
      },
    ],
    evidence: [],
    summaryForParent: ["v2 상담 프로필을 v1 matching 점수 계산용으로 변환했습니다."],
    followUpQuestions: [],
  }
}

export function buildLegacyReadinessInputFromV2(profile: ConsultingProfile): CampReadinessResult {
  const help = normalizedScore(numberValue(profile.childReadiness, "english_help_seeking"), 0.42)
  const comprehension = normalizedScore(numberValue(profile.childReadiness, "english_comprehension"), 0.42)
  const social = normalizedScore(numberValue(profile.childReadiness, "social_confidence"), 0.5)
  const anxiety = riskSignals(profile).includes("english_overload") ? 0.72 : 0.45
  const average = (help + comprehension + social + (1 - anxiety)) / 4

  return {
    basicInstructionUnderstanding: comprehension,
    helpRequestAbility: help,
    survivalExpression: help,
    peerInteractionReadiness: social,
    basicSelfExpression: help,
    englishAnxietySignal: anxiety,
    communicationAttemptTendency: 1 - anxiety * 0.7,
    overallReadiness: average < 0.38 ? "early_adaptation" : average < 0.6 ? "basic_adaptation" : "moderate_ready",
    recommendedSupport: help < 0.5 ? ["beginner_class", "korean_manager", "early_adaptation_support"] : ["buddy_system"],
  }
}

export function buildLegacyMatchingPayload(profile: ConsultingProfile): LegacyMatchingPayload {
  return {
    input: buildLegacyParentInputFromV2(profile),
    analysis: buildLegacyParentAnalysisFromV2(profile),
    readiness: buildLegacyReadinessInputFromV2(profile),
    warnings: legacyWarnings(profile),
  }
}

function legacyWarnings(profile: ConsultingProfile): readonly string[] {
  return [
    "legacy_required_dummy_grade: v1 matching type requires a school-year field; v2 does not store or expose it.",
    "v2_total_all_in_budget_not_mapped_to_v1_budget_range: budget is handled by v2 budget estimates.",
    ...(profile.legacyParentInput === undefined ? [] : ["legacy profile placeholder was present"]),
  ]
}

function englishSelfLevel(profile: ConsultingProfile): CampfitInput["englishSelfLevel"] {
  const score = numberValue(profile.childReadiness, "english_help_seeking")
  if (score === undefined) {
    return riskSignals(profile).includes("english_overload") ? "almost_none" : "unsure"
  }

  return score >= 4 ? "simple_conversation" : score >= 3 ? "basic_expression" : "almost_none"
}

function levelFromReadinessScore(score: number | undefined, inverted: boolean): CampfitInput["shynessLevel"] {
  if (score === undefined) {
    return "medium"
  }

  if (inverted) {
    return score >= 4 ? "low" : score >= 3 ? "medium" : "high"
  }

  return score >= 4 ? "high" : score >= 3 ? "medium" : "low"
}

function destinationPreference(profile: ConsultingProfile): CampfitInput["destinationPreference"] {
  const region = preferredRegions(profile)[0]
  return region === "southeast_asia" || region === "oceania" || region === "north_america" ? region : "no_preference"
}

function durationWeeks(profile: ConsultingProfile): CampfitInput["durationWeeks"] {
  const max = numberValue(profile.hardConstraints, "durationWeeksMax")
  if (max === undefined || max <= 1) {
    return "1w"
  }

  return max <= 2 ? "2w" : max <= 4 ? "3_4w" : "over_4w"
}

function parentPreference(profile: ConsultingProfile): CampfitInput["parentAccompanied"] {
  const mode = parentAccompanimentMode(profile)
  return mode === "parent_required" ? "required" : mode === "parent_can_stay" ? "preferred" : "not_needed"
}

function koreanManagerPreference(profile: ConsultingProfile): CampfitInput["koreanManagerRequired"] {
  const need = koreanSupportNeed(profile)
  return need === "resident_korean_manager" || need === "daily_korean_communication" ? "required" : "preferred"
}

function programTypePreference(profile: ConsultingProfile): ProgramType {
  const values = preferredProgramTypes(profile)
  if (values.some((value) => value.includes("school"))) {
    return "schooling"
  }

  if (values.includes("family_esl")) {
    return "family_esl"
  }

  if (values.some((value) => value.includes("activity"))) {
    return "activity"
  }

  return values.includes("managed_immersion") ? "managed_immersion" : "unsure"
}

function normalizedScore(score: number | undefined, fallback: number): number {
  if (score === undefined) {
    return fallback
  }

  return score > 1 ? score / 5 : score
}
