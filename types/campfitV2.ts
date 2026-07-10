export const regionGroups = [
  "southeast_asia",
  "oceania",
  "north_america",
  "europe",
  "domestic",
  "no_preference",
  "undecided",
] as const
export type RegionGroup = (typeof regionGroups)[number]

export const departureWindows = [
  "winter_break",
  "summer_break",
  "within_3_months",
  "within_6_months",
  "within_1_year",
  "undecided",
] as const
export type DepartureWindow = (typeof departureWindows)[number]

export const budgetScopes = ["child_only", "child_plus_one_parent", "family_total", "unknown"] as const
export type BudgetScope = (typeof budgetScopes)[number]

export const regionPriorities = ["hard", "strong", "flexible", "low"] as const
export type RegionPriority = (typeof regionPriorities)[number]

export const parentAccompanimentModes = [
  "parent_required",
  "parent_can_stay",
  "departure_arrival_only",
  "child_solo_or_chaperone_ok",
  "undecided",
] as const
export type ParentAccompanimentMode = (typeof parentAccompanimentModes)[number]

export const koreanSupportNeeds = [
  "resident_korean_manager",
  "daily_korean_communication",
  "emergency_only",
  "not_needed",
  "undecided",
] as const
export type KoreanSupportNeed = (typeof koreanSupportNeeds)[number]

export const accommodationPreferences = [
  "parent_stay",
  "homestay",
  "dormitory",
  "hotel_resort",
  "day_only",
  "undecided",
] as const
export type AccommodationPreference = (typeof accommodationPreferences)[number]

export const questionTypes = ["single_choice", "multi_choice", "number", "text"] as const
export type QuestionType = (typeof questionTypes)[number]

export const recommendationTiers = ["best_fit", "good_with_support", "possible_if_adjusted", "not_recommended"] as const
export type RecommendationTier = (typeof recommendationTiers)[number]

export const programModeKeys = [
  "international_school_regular",
  "international_school_camp",
  "family_esl",
  "language_school_esl",
  "managed_immersion",
  "activity_sports",
  "steam_project",
  "homestay_schooling",
  "residential_international_camp",
  "culture_activity",
] as const
export type ProgramModeKey = (typeof programModeKeys)[number]

export type ProgramModeFitProfile = {
  readonly modeKey: ProgramModeKey
  readonly title: string
  readonly shortTitle: string
  readonly description: string
  readonly englishExposure: number
  readonly academicIntensity: number
  readonly parentSeparationLoad: number
  readonly independenceRequired: number
  readonly socialIntensity: number
  readonly routineStability: number
  readonly activityLoad: number
  readonly beginnerFriendly: number
  readonly parentAccompanimentFit: number
  readonly koreanSupportCompatibility: number
  readonly smallGroupFit: number
  readonly emotionalSafetyFit: number
  readonly dailyLifeSupportNeed: number
  readonly dailyLifeSupportCoverage: number
  readonly englishConfidenceFit: number
  readonly englishImprovementFit: number
  readonly internationalSchoolExposureFit: number
  readonly culturalExposureFit: number
  readonly confidenceGrowthFit: number
  readonly independenceGrowthFit: number
  readonly academicGrowthFit: number
  readonly activityExperienceFit: number
  readonly studyAbroadTrialFit: number
  readonly safeCareFit: number
  readonly budgetPressure: number
  readonly durationFlexibility: number
  readonly parentStayPracticality: number
  readonly bestFor: readonly string[]
  readonly watchOut: readonly string[]
  readonly verifyBeforeConsulting: readonly string[]
  readonly imageKey: string
  readonly imageAlt: string
  readonly imageTheme: string
  readonly imagePath: string | null
}

export type ProgramModeScoreBreakdown = {
  readonly childFit: number
  readonly goalFit: number
  readonly supportFit: number
  readonly familyConstraintFit: number
  readonly riskFit: number
  readonly budgetRealityFit: number
}

export type ProgramModeRecommendation = {
  readonly key: ProgramModeKey
  readonly title: string
  readonly shortTitle?: string
  readonly description?: string
  readonly score: number
  readonly tier: RecommendationTier
  readonly fitLabel: string
  readonly whyFits: readonly string[]
  readonly tradeoffs: readonly string[]
  readonly bestFor: readonly string[]
  readonly verifyBeforeConsulting: readonly string[]
  readonly scoreBreakdown: ProgramModeScoreBreakdown
  readonly imageKey: string
  readonly imagePath: string | null
  readonly imageAlt: string
}

export type TravelerCounts = {
  readonly child: number
  readonly parent: number
  readonly sibling: number
}

export type RequiredIntake = {
  readonly childAgeAtStart: number
  readonly departureWindow: DepartureWindow
  readonly durationWeeksMin?: number
  readonly durationWeeksMax?: number
  readonly totalBudgetAllInKrwMin?: number
  readonly totalBudgetAllInKrwMax?: number
  readonly budgetScope: BudgetScope
  readonly travelerCounts: TravelerCounts
  readonly preferredRegionGroups: readonly RegionGroup[]
  readonly regionPriority: RegionPriority
  readonly parentAccompanimentMode: ParentAccompanimentMode
  readonly koreanSupportNeed: KoreanSupportNeed
  readonly accommodationPreferences: readonly AccommodationPreference[]
  readonly rawAnswers?: Record<string, unknown>
}

export type NaturalConsultationInput = {
  readonly situationText: string
  readonly childContextText?: string
  readonly successAndConcernsText?: string
  readonly additionalNotes?: string
}

export type MissingSlot = {
  readonly slotKey: string
  readonly reason: string
  readonly importance: "high" | "medium" | "low"
}

export type ProfileConflict = {
  readonly conflictKey: string
  readonly description: string
  readonly severity: "high" | "medium" | "low"
  readonly recommendedQuestionKey?: string
}

export type AIExtractionResult = {
  readonly extractedProfile: Record<string, unknown>
  readonly missingSlots: readonly MissingSlot[]
  readonly conflicts: readonly ProfileConflict[]
  readonly confidenceMap: Record<string, number>
  readonly recommendedQuestionKeys: readonly string[]
  readonly understandingSummaryForUser: string
}

export type DynamicQuestionOption = {
  readonly value: string
  readonly label: string
  readonly score?: number
}

export type DynamicQuestion = {
  readonly questionKey: string
  readonly title: string
  readonly helperText?: string
  readonly questionType: QuestionType
  readonly options: readonly DynamicQuestionOption[]
  readonly reason: string
  readonly priority: number
}

export type DynamicAnswer = {
  readonly questionKey: string
  readonly answer: unknown
  readonly answerText?: string
}

export type BudgetEstimate = {
  readonly regionGroup: RegionGroup
  readonly availableProgramBudgetKrwMin?: number
  readonly availableProgramBudgetKrwMax?: number
  readonly flags: readonly ("unknown_cost_assumption" | "comparison_estimate" | "needs_consultation_check")[]
  readonly note: string
}

export type ConsultingProfile = {
  readonly hardConstraints: Record<string, unknown>
  readonly strongPreferences: Record<string, unknown>
  readonly softPreferences: Record<string, unknown>
  readonly childReadiness: Record<string, unknown>
  readonly parentIntent: Record<string, unknown>
  readonly riskProfile: Record<string, unknown>
  readonly flexibility: Record<string, unknown>
  readonly budgetEstimates: readonly BudgetEstimate[]
  readonly recommendationStrategy?: string
  readonly legacyParentInput?: Record<string, unknown>
  readonly legacyParentAnalysis?: Record<string, unknown>
}

export type RecommendationCardV2 = {
  readonly programId: string
  readonly programName: string
  readonly tier: RecommendationTier
  readonly fitScoreSummary: FitScoreSummary
  readonly fitSummary: string
  readonly matchedConditions: readonly string[]
  readonly mismatchedConditions: readonly string[]
  readonly recommendDespiteMismatchReason?: string
  readonly childFit: string
  readonly familyFit: string
  readonly riskLevel: "low" | "medium" | "high"
  readonly riskReasons: readonly string[]
  readonly mitigation: readonly string[]
  readonly consultingChecklist: readonly string[]
}

export const fitAxisKeys = [
  "child_fit",
  "english_readiness",
  "family_constraints",
  "support_fit",
  "growth_balance",
  "budget_reality",
  "risk_management",
] as const
export type FitAxisKey = (typeof fitAxisKeys)[number]

export type FitScoreAxis = {
  readonly key: FitAxisKey
  readonly label: string
  readonly score: number
  readonly comment: string
}

export type FitScoreSummary = {
  readonly overallScore: number
  readonly tier: RecommendationTier
  readonly label: string
  readonly axes: readonly FitScoreAxis[]
}

export type ExcludedCandidateV2 = {
  readonly programId: string
  readonly programName: string
  readonly excludedReasons: readonly string[]
  readonly conditionRelaxation: readonly string[]
  readonly stillWorthConsideringReason?: string
}

export type RecommendationReportV2 = {
  readonly conclusion: string
  readonly fitScoreSummary: FitScoreSummary
  readonly familySummary: string
  readonly childReadinessSummary: string
  readonly programModeRecommendations: readonly ProgramModeRecommendation[]
  readonly destinationRecommendations: readonly import("@/types/campfitCity").DestinationRecommendationV2[]
  readonly optionGroups: readonly ReportOptionGroup[]
  readonly recommendations: readonly RecommendationCardV2[]
  readonly excludedCandidates: readonly ExcludedCandidateV2[]
  readonly excludedSummaryGroups: readonly ExcludedSummaryGroup[]
  readonly conditionRelaxationSuggestions: readonly string[]
  readonly consultingChecklist: readonly string[]
}

export type ReportOptionGroup = {
  readonly key: "keep_preferred_region" | "prioritize_child_fit" | "prioritize_budget_and_support"
  readonly title: string
  readonly fitLabel: string
  readonly score: number
  readonly matchedPoints: readonly string[]
  readonly tradeoffs: readonly string[]
  readonly suggestedAction: string
}

export type ExcludedSummaryGroup = {
  readonly key: string
  readonly label: string
  readonly count: number
}

export { cityDataQualities } from "@/types/campfitCity"
export type { CityDataQuality, CityFitProfile, DestinationRecommendationV2 } from "@/types/campfitCity"
