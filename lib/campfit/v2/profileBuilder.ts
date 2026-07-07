import { z } from "zod"
import { estimateAvailableProgramBudget } from "@/lib/campfit/v2/budgetEstimator"
import type {
  AIExtractionResult,
  BudgetEstimate,
  ConsultingProfile,
  DynamicAnswer,
  NaturalConsultationInput,
  RequiredIntake,
} from "@/types/campfitV2"

type ProfileBuilderInput = {
  readonly requiredIntake: RequiredIntake
  readonly naturalInput: NaturalConsultationInput
  readonly extraction: AIExtractionResult
  readonly dynamicAnswers?: readonly DynamicAnswer[]
  readonly budgetEstimates?: readonly BudgetEstimate[]
}

const AnswerObjectSchema = z
  .object({
    value: z.string().optional(),
    values: z.array(z.string()).optional(),
    score: z.number().min(0).max(5).optional(),
  })
  .strict()

export function buildCampfitV2ConsultingProfile(input: ProfileBuilderInput): ConsultingProfile {
  const dynamicSignals = mergeDynamicAnswersIntoProfile(input.dynamicAnswers ?? [])
  const budgetEstimates =
    input.budgetEstimates ?? estimateAvailableProgramBudget({ requiredIntake: input.requiredIntake, assumptions: [] })
  const childReadiness = {
    ...readinessFromExtraction(input.extraction),
    ...dynamicSignals.childReadiness,
  }
  const parentIntent = {
    ...intentFromExtraction(input.extraction),
    ...dynamicSignals.parentIntent,
    naturalSummary: input.naturalInput.situationText,
  }
  const riskProfile = {
    riskSignals: getStringArray(input.extraction.extractedProfile, "riskSignals"),
    avoidSignals: getStringArray(input.extraction.extractedProfile, "avoidSignals"),
    conflicts: input.extraction.conflicts,
    ...dynamicSignals.riskProfile,
  }
  const flexibility = {
    flexibilitySignals: getStringArray(input.extraction.extractedProfile, "flexibilitySignals"),
    ...dynamicSignals.flexibility,
  }
  const recommendationStrategy = inferRecommendationStrategy({
    requiredIntake: input.requiredIntake,
    extraction: input.extraction,
    childReadiness,
    parentIntent,
    riskProfile,
  })

  return {
    hardConstraints: {
      childAgeAtStart: input.requiredIntake.childAgeAtStart,
      durationWeeksMin: input.requiredIntake.durationWeeksMin,
      durationWeeksMax: input.requiredIntake.durationWeeksMax,
      totalBudgetAllInKrwMin: input.requiredIntake.totalBudgetAllInKrwMin,
      totalBudgetAllInKrwMax: input.requiredIntake.totalBudgetAllInKrwMax,
      budgetScope: input.requiredIntake.budgetScope,
      travelerCounts: input.requiredIntake.travelerCounts,
      parentAccompanimentMode: input.requiredIntake.parentAccompanimentMode,
      koreanSupportNeed: input.requiredIntake.koreanSupportNeed,
    },
    strongPreferences: {
      preferredRegionGroups: input.requiredIntake.preferredRegionGroups,
      regionPriority: input.requiredIntake.regionPriority,
      accommodationPreferences: input.requiredIntake.accommodationPreferences,
      detectedProgramTypes: getStringArray(input.extraction.extractedProfile, "detectedProgramTypes"),
    },
    softPreferences: {
      detectedRegions: getStringArray(input.extraction.extractedProfile, "detectedRegions"),
      ...dynamicSignals.softPreferences,
    },
    childReadiness,
    parentIntent,
    riskProfile,
    flexibility,
    budgetEstimates,
    recommendationStrategy,
    legacyParentInput: {
      childAge: input.requiredIntake.childAgeAtStart,
      note: "CampFit v2 adapter placeholder. Do not pass total all-in budget directly as legacy budgetMax.",
    },
    legacyParentAnalysis: {
      summaryForParent: input.extraction.understandingSummaryForUser,
      supportSignals: dynamicSignals.supportSignals,
      conflicts: input.extraction.conflicts,
    },
  }
}

export function mergeDynamicAnswersIntoProfile(dynamicAnswers: readonly DynamicAnswer[]): {
  readonly childReadiness: Record<string, unknown>
  readonly parentIntent: Record<string, unknown>
  readonly riskProfile: Record<string, unknown>
  readonly flexibility: Record<string, unknown>
  readonly softPreferences: Record<string, unknown>
  readonly supportSignals: readonly string[]
} {
  const childReadiness: Record<string, unknown> = {}
  const parentIntent: Record<string, unknown> = {}
  const riskProfile: Record<string, unknown> = {}
  const flexibility: Record<string, unknown> = {}
  const softPreferences: Record<string, unknown> = {}
  const supportSignals: string[] = []

  for (const answer of dynamicAnswers) {
    const values = answerValues(answer.answer)
    const score = mapAnswerToScore(answer.answer)
    switch (answer.questionKey) {
      case "english_help_seeking":
      case "english_comprehension":
      case "english_speaking_anxiety":
      case "transition_readiness":
      case "social_confidence":
      case "resilience":
      case "daily_life_independence":
      case "activity_tolerance":
        childReadiness[answer.questionKey] = score ?? values
        break
      case "separation_experience":
      case "adaptability":
        childReadiness[answer.questionKey] = values
        break
      case "primary_goals":
      case "international_school_intent":
      case "english_outcome_expectation":
        parentIntent[answer.questionKey] = values
        break
      case "preferred_program_types":
      case "korean_peer_ratio_preference":
        softPreferences[answer.questionKey] = values
        break
      case "top_concerns":
      case "avoid_conditions":
      case "unacceptable_outcome":
      case "special_care_needs":
        riskProfile[answer.questionKey] = answer.answerText ?? values
        supportSignals.push(...values)
        break
      case "flexibility":
      case "mismatch_tolerance":
        flexibility[answer.questionKey] = values
        break
      default:
        softPreferences[answer.questionKey] = values.length > 0 ? values : answer.answer
        break
    }
  }

  return { childReadiness, parentIntent, riskProfile, flexibility, softPreferences, supportSignals }
}

export function inferRecommendationStrategy(input: {
  readonly requiredIntake: RequiredIntake
  readonly extraction: AIExtractionResult
  readonly childReadiness: Record<string, unknown>
  readonly parentIntent: Record<string, unknown>
  readonly riskProfile: Record<string, unknown>
}): string {
  const riskSignals = getStringArray(input.extraction.extractedProfile, "riskSignals")
  const parentGoals = getStringArray(input.extraction.extractedProfile, "parentGoals")
  const detectedProgramTypes = getStringArray(input.extraction.extractedProfile, "detectedProgramTypes")
  const readinessScore = averageKnownScores(input.childReadiness)
  const wantsParentStay = ["parent_required", "parent_can_stay"].includes(input.requiredIntake.parentAccompanimentMode)

  if (riskSignals.includes("english_overload") && riskSignals.includes("separation_risk")) {
    return "safe_first_camp"
  }

  if (wantsParentStay && riskSignals.includes("english_overload")) {
    return "parent_accompanied_exposure"
  }

  if (detectedProgramTypes.some((programType) => programType === "international_school_regular" || programType === "schooling")) {
    return "international_school_trial"
  }

  if (parentGoals.includes("english_improvement") && readinessScore >= 3) {
    return "english_boost_with_support"
  }

  if (parentGoals.includes("independence") && readinessScore >= 3.5) {
    return "independence_growth"
  }

  if (detectedProgramTypes.includes("activity_sports")) {
    return "activity_based_confidence"
  }

  if (riskSignals.length >= 3 && readinessScore < 2) {
    return "not_ready_or_no_match"
  }

  return "safe_first_camp"
}

export function mapAnswerToScore(answer: unknown): number | undefined {
  if (typeof answer === "number") {
    return answer
  }

  const parsed = AnswerObjectSchema.safeParse(answer)
  if (parsed.success) {
    return parsed.data.score
  }

  return undefined
}

function readinessFromExtraction(extraction: AIExtractionResult): Record<string, unknown> {
  return {
    childSignals: getStringArray(extraction.extractedProfile, "childSignals"),
    riskSignals: getStringArray(extraction.extractedProfile, "riskSignals"),
  }
}

function intentFromExtraction(extraction: AIExtractionResult): Record<string, unknown> {
  return {
    parentGoals: getStringArray(extraction.extractedProfile, "parentGoals"),
    confidenceMap: extraction.confidenceMap,
  }
}

function answerValues(answer: unknown): readonly string[] {
  if (typeof answer === "string") {
    return [answer]
  }

  if (Array.isArray(answer)) {
    return answer.filter((item): item is string => typeof item === "string")
  }

  const parsed = AnswerObjectSchema.safeParse(answer)
  if (!parsed.success) {
    return []
  }

  if (parsed.data.values !== undefined) {
    return parsed.data.values
  }

  return parsed.data.value === undefined ? [] : [parsed.data.value]
}

function averageKnownScores(record: Record<string, unknown>): number {
  const scores = Object.values(record).filter((value): value is number => typeof value === "number")
  if (scores.length === 0) {
    return 0
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function getStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}
