export const gradeOptions = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3"] as const
export type Grade = (typeof gradeOptions)[number]

export const englishSelfLevels = [
  "unsure",
  "almost_none",
  "basic_expression",
  "simple_conversation",
  "comfortable",
] as const
export type EnglishSelfLevel = (typeof englishSelfLevels)[number]

export const overseasExperienceOptions = ["none", "travel_only", "camp_experience"] as const
export type OverseasExperience = (typeof overseasExperienceOptions)[number]

export const levelOptions = ["low", "medium", "high"] as const
export type LevelOption = (typeof levelOptions)[number]

export const budgetRangeOptions = ["under_3m", "3m_5m", "5m_8m", "over_8m"] as const
export type BudgetRange = (typeof budgetRangeOptions)[number]

export const destinationPreferenceOptions = ["no_preference", "southeast_asia", "oceania", "north_america"] as const
export type DestinationPreference = (typeof destinationPreferenceOptions)[number]

export const travelReadinessOptions = ["short_flight_care", "moderate_distance", "long_flight_independent"] as const
export type TravelReadiness = (typeof travelReadinessOptions)[number]

export const durationWeekOptions = ["1w", "2w", "3_4w", "over_4w"] as const
export type DurationWeeks = (typeof durationWeekOptions)[number]

export const parentAccompaniedOptions = ["required", "preferred", "not_needed", "unsure"] as const
export type ParentAccompaniedPreference = (typeof parentAccompaniedOptions)[number]

export const koreanManagerRequiredOptions = ["required", "preferred", "not_needed"] as const
export type KoreanManagerRequired = (typeof koreanManagerRequiredOptions)[number]

export const programTypeOptions = [
  "managed_immersion",
  "schooling",
  "family_esl",
  "activity",
  "creative_daycamp",
  "international_camp",
  "unsure",
] as const
export type ProgramType = (typeof programTypeOptions)[number]

export const supportKeys = [
  "beginner_class",
  "korean_manager",
  "korean_dorm_option",
  "parent_accompanied",
  "buddy_system",
  "early_adaptation_support",
  "daily_parent_report",
  "low_pressure_speaking_environment",
  "small_group_care",
] as const
export type SupportKey = (typeof supportKeys)[number]

export const fitTypes = ["comfort", "stretch", "overreach", "underchallenge"] as const
export type FitType = (typeof fitTypes)[number]

export type CampfitInput = {
  readonly childAge: number
  readonly grade: Grade
  readonly englishSelfLevel: EnglishSelfLevel
  readonly overseasExperience: OverseasExperience
  readonly shynessLevel: LevelOption
  readonly separationTolerance: LevelOption
  readonly budgetRange: BudgetRange
  readonly destinationPreference: DestinationPreference
  readonly travelReadiness: TravelReadiness
  readonly durationWeeks: DurationWeeks
  readonly parentAccompanied: ParentAccompaniedPreference
  readonly koreanManagerRequired: KoreanManagerRequired
  readonly preferredProgramType: ProgramType
  readonly parentConcernText: string
}

export type ParentGoal = {
  readonly englishGrowth: number
  readonly confidenceGrowth: number
  readonly independenceGrowth: number
  readonly socialGrowth: number
  readonly safetyPriority: number
  readonly academicResultPriority: number
  readonly experiencePriority: number
}

export type ChildProfile = {
  readonly englishReadiness: number
  readonly socialConfidence: number
  readonly separationTolerance: number
  readonly newEnvironmentAdaptability: number
  readonly challengeTolerance: number
}

export type DetectedTension = {
  readonly type:
    | "care_vs_independence"
    | "english_growth_vs_anxiety"
    | "academic_result_vs_burden"
    | "budget_vs_care"
    | "safety_vs_challenge"
  readonly description: string
  readonly confidence: number
}

export type EvidenceItem = {
  readonly text: string
  readonly mappedTo: string
  readonly impact: "increase" | "decrease"
}

export type ParentAnalysis = {
  readonly parentType: string
  readonly parentGoal: ParentGoal
  readonly childProfile: ChildProfile
  readonly supportNeeded: readonly SupportKey[]
  readonly detectedTensions: readonly DetectedTension[]
  readonly evidence: readonly EvidenceItem[]
  readonly summaryForParent: readonly string[]
  readonly followUpQuestions: readonly string[]
}

export type AiUsageStatus = {
  readonly parentAnalysis: boolean
  readonly recommendationExplanation: boolean
}

export type ReadinessChoice = "A" | "B" | "C" | "D"
export type ReadinessDraftChoice = ReadinessChoice | ""

export type ReadinessAnswers = {
  readonly q1: ReadinessChoice
  readonly q2: ReadinessChoice
  readonly q3: ReadinessChoice
  readonly q4: ReadinessChoice
  readonly q5: string
  readonly q6: ReadinessChoice
}

export type ReadinessDraftAnswers = {
  readonly q1: ReadinessDraftChoice
  readonly q2: ReadinessDraftChoice
  readonly q3: ReadinessDraftChoice
  readonly q4: ReadinessDraftChoice
  readonly q5: string
  readonly q6: ReadinessDraftChoice
}

export type CampReadinessResult = {
  readonly basicInstructionUnderstanding: number
  readonly helpRequestAbility: number
  readonly survivalExpression: number
  readonly peerInteractionReadiness: number
  readonly basicSelfExpression: number
  readonly englishAnxietySignal: number
  readonly communicationAttemptTendency: number
  readonly overallReadiness: "early_adaptation" | "basic_adaptation" | "moderate_ready" | "high_ready"
  readonly recommendedSupport: readonly SupportKey[]
}

export type DifficultyProfile = {
  readonly englishExposure: number
  readonly boardingIndependence: number
  readonly academicIntensity: number
  readonly foreignPeerInteraction: number
  readonly parentSeparation: number
}

export type SupportBuffer = Record<SupportKey, number>

export type Camp = {
  readonly id: string
  readonly name: string
  readonly country: string
  readonly city: string
  readonly programType: Exclude<ProgramType, "unsure">
  readonly ageMin: number
  readonly ageMax: number
  readonly budgetMinKrw: number
  readonly budgetMaxKrw: number
  readonly durationWeeks: readonly DurationWeeks[]
  readonly koreanManager: boolean
  readonly parentAccompanied: boolean
  readonly koreanDormOption: boolean
  readonly beginnerClass: boolean
  readonly buddySystem: boolean
  readonly dailyParentReport: boolean
  readonly lowPressureSpeaking: boolean
  readonly smallGroupCare: boolean
  readonly traits: readonly string[]
  readonly difficulty: DifficultyProfile
  readonly supportBuffer: SupportBuffer
}

export type RecommendationExplanation = {
  readonly reason: string
  readonly caution: string
  readonly questionsBeforeConsultation: readonly string[]
}

export type CampRecommendation = {
  readonly camp: Camp
  readonly fitType: FitType
  readonly score: number
  readonly explanation: RecommendationExplanation
  readonly debugScores: {
    readonly goalFit: number
    readonly supportFit: number
    readonly challengeLoad: number
    readonly childReadiness: number
    readonly residualRisk: number
    readonly growthPotential: number
  }
}

export type RecommendRequest = {
  readonly sessionId?: string
  readonly input: CampfitInput
  readonly analysis: ParentAnalysis
  readonly aiUsage?: Pick<AiUsageStatus, "parentAnalysis">
  readonly followUpAnswers: readonly string[]
  readonly readinessAnswers: ReadinessAnswers
}

export type RecommendationResult = {
  readonly sessionId: string
  readonly analysis: ParentAnalysis
  readonly aiUsage: AiUsageStatus
  readonly readiness: CampReadinessResult
  readonly recommendations: readonly CampRecommendation[]
  readonly noCandidateMessage?: string
}

export type FeedbackValue = "good_fit" | "different" | "unsure" | "consultation_requested"
