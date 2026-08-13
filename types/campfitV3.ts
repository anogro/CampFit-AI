export const CAMPFIT_V3_MIN_DURATION_WEEKS = 1
export const CAMPFIT_V3_MAX_DURATION_WEEKS = 12

export const campfitV3FactSources = [
  "ai_inference",
  "explicit_user_statement",
  "quick_reply",
  "structured_input",
  "user_correction",
] as const
export type CampfitV3FactSource = (typeof campfitV3FactSources)[number]

export const campfitV3FactSubjects = ["child", "parent", "family", "preference", "constraint"] as const
export type CampfitV3FactSubject = (typeof campfitV3FactSubjects)[number]

export const campfitV3FactKeys = [
  "childEnglishLevel",
  "childEnglishExperience",
  "childEnglishEnvironment",
  "childEnglishAssessment",
  "childEnglishListening",
  "childEnglishSpeaking",
  "childEnglishReading",
  "childEnglishWriting",
  "childEnglishUsage",
  "englishReadiness",
  "parentEnglishCommunication",
  "isFirstOverseasEducationExperience",
  "dayProgramSeparationReadiness",
  "preferredActivities",
  "activityPreferences",
  "participationProfile",
  "destinationPreference",
  "socialPreference",
  "desiredOutcomes",
  "worries",
  "parentExperienceNeeds",
  "experienceGoals",
  "preferredRegions",
  "excludedRegions",
  "regionImportance",
  "koreanSupportNeed",
  "programCommuteNeed",
  "programMealNeed",
  "parentCommunicationNeed",
  "beginnerSupportNeed",
  "initialAdaptationSupportNeed",
  "parentStayGoals",
  "specialCareFollowUp",
  "studyOnlyAvoidance",
  "budgetRangeKrw",
  "budgetIncludesFlight",
  "departureWindow",
  "durationWeeks",
] as const
export type CampfitV3FactKey = (typeof campfitV3FactKeys)[number]

export const campfitV3EnglishReadinessValues = [
  "support_required",
  "beginner_friendly",
  "general_program_ready",
  "academic_ready",
  "unknown",
] as const
export type CampfitV3EnglishReadiness = (typeof campfitV3EnglishReadinessValues)[number]

export const campfitV3EnglishExperienceTypes = [
  "english_kindergarten",
  "english_academy",
  "english_class",
  "english_immersion",
] as const
export type CampfitV3EnglishExperienceType = (typeof campfitV3EnglishExperienceTypes)[number]

export const campfitV3EnglishEnvironmentTypes = [
  "international_school",
  "overseas_school",
  "overseas_camp",
  "overseas_residence",
] as const
export type CampfitV3EnglishEnvironmentType = (typeof campfitV3EnglishEnvironmentTypes)[number]

export const campfitV3EnglishAssessmentTypes = ["ar", "lexile", "english_exam", "school_level"] as const
export type CampfitV3EnglishAssessmentType = (typeof campfitV3EnglishAssessmentTypes)[number]

export type CampfitV3EnglishExperience = {
  readonly type: CampfitV3EnglishExperienceType
  readonly durationYears: number | null
  readonly ongoing: boolean | null
}

export type CampfitV3EnglishAssessment = {
  readonly type: CampfitV3EnglishAssessmentType
  readonly value: number | string
}

export const campfitV3ParentExperienceNeedAxes = [
  "english_growth",
  "peer_interaction",
  "global_experience",
  "independence_confidence",
  "school_learning_experience",
] as const
export type CampfitV3ParentExperienceNeedAxis = (typeof campfitV3ParentExperienceNeedAxes)[number]

export const campfitV3ParentNeedImportanceValues = [
  "primary",
  "important",
  "nice_to_have",
  "unspecified",
  "avoid",
] as const
export type CampfitV3ParentNeedImportance = (typeof campfitV3ParentNeedImportanceValues)[number]

export type CampfitV3ParentExperienceNeed = {
  readonly importance: CampfitV3ParentNeedImportance
  /** Short user-grounded snippets retained for semantic synthesis and audit. */
  readonly evidence: readonly string[]
}

export type CampfitV3ParentExperienceNeeds = Readonly<Record<CampfitV3ParentExperienceNeedAxis, CampfitV3ParentExperienceNeed>>

export const campfitV3ActivityPreferenceCategories = [
  "stem_maker",
  "sports_physical",
  "nature_outdoor",
  "animals_ecology",
  "art_creative",
  "performance_music",
  "culture_lifestyle",
] as const
export type CampfitV3ActivityPreferenceCategory = (typeof campfitV3ActivityPreferenceCategories)[number]

export const campfitV3ActivityPreferenceStrengths = ["strong", "positive", "neutral", "dislike"] as const
export type CampfitV3ActivityPreferenceStrength = (typeof campfitV3ActivityPreferenceStrengths)[number]

export const campfitV3VarietyPreferenceValues = ["strong", "positive", "unspecified"] as const
export type CampfitV3VarietyPreference = (typeof campfitV3VarietyPreferenceValues)[number]

export type CampfitV3ActivityPreference = {
  readonly category: CampfitV3ActivityPreferenceCategory
  readonly strength: CampfitV3ActivityPreferenceStrength
  readonly rank: number | null
  readonly mentionedActivities: readonly string[]
  readonly evidence: readonly string[]
}

export type CampfitV3ActivityPreferenceProfile = {
  readonly preferences: readonly CampfitV3ActivityPreference[]
  /** Variety/breadth is a child preference, not the program's multi_activity label. */
  readonly varietyPreference: CampfitV3VarietyPreference
  readonly evidence: readonly string[]
}

export const campfitV3ParticipationAdaptationLevels = [
  "warm_up_needed",
  "comfortable_after_warm_up",
  "quick_to_adapt",
  "unknown",
] as const
export type CampfitV3ParticipationAdaptationLevel = (typeof campfitV3ParticipationAdaptationLevels)[number]

export const campfitV3PeerInteractionStyleLevels = [
  "initially_cautious_after_warm_up",
  "small_group_comfortable",
  "initiates_easily",
  "unknown",
] as const
export type CampfitV3PeerInteractionStyleLevel = (typeof campfitV3PeerInteractionStyleLevels)[number]

export const campfitV3ParentDistanceComfortLevels = [
  "comfortable_without_parent",
  "proximity_needed",
  "unknown",
] as const
export type CampfitV3ParentDistanceComfortLevel = (typeof campfitV3ParentDistanceComfortLevels)[number]

export const campfitV3ParticipationStyleLevels = [
  "observation_first",
  "active_starter",
  "structured_preferred",
  "free_activity_preferred",
  "unknown",
] as const
export type CampfitV3ParticipationStyleLevel = (typeof campfitV3ParticipationStyleLevels)[number]

export const campfitV3ParticipationEvidenceSubjects = ["child_state", "parent_preference", "ambiguous"] as const
export type CampfitV3ParticipationEvidenceSubject = (typeof campfitV3ParticipationEvidenceSubjects)[number]

export type CampfitV3ParticipationAxis<T extends string> = {
  readonly level: T
  readonly evidence: readonly string[]
  readonly confidence: number
  readonly subject: CampfitV3ParticipationEvidenceSubject
}

export type CampfitV3ParticipationProfile = {
  readonly adaptation_to_new_environment: CampfitV3ParticipationAxis<CampfitV3ParticipationAdaptationLevel>
  readonly peer_interaction_style: CampfitV3ParticipationAxis<CampfitV3PeerInteractionStyleLevel>
  readonly parent_distance_comfort: CampfitV3ParticipationAxis<CampfitV3ParentDistanceComfortLevel>
  readonly participation_style: CampfitV3ParticipationAxis<CampfitV3ParticipationStyleLevel>
  /** A separate child-state signal; class independence is not the same as parent proximity comfort. */
  readonly independent_class_participation: "ready" | "needs_support" | "unknown"
  readonly parent_preference_evidence: readonly string[]
  readonly ambiguous_evidence: readonly string[]
  /** Original short snippets retained for evidence audit and semantic synthesis. */
  readonly raw_evidence: readonly string[]
}

export const campfitV3FactStatuses = ["known", "unknown", "tentative", "confirmed"] as const
export type CampfitV3FactStatus = (typeof campfitV3FactStatuses)[number]

export type CampfitV3Fact = {
  readonly key: CampfitV3FactKey
  readonly subject: CampfitV3FactSubject
  readonly value: unknown
  readonly source: CampfitV3FactSource
  readonly confidence: number
  /** Runtime-created facts always include this; optional keeps old session fixtures readable. */
  readonly status?: CampfitV3FactStatus
  readonly evidence: string
  readonly updatedAt: string
}

export type CampfitV3Conflict = {
  readonly key: CampfitV3FactKey
  readonly reason: string
}

export type CampfitV3ConversationState = {
  readonly facts: Partial<Record<CampfitV3FactKey, CampfitV3Fact>>
  readonly askedQuestionKeys: readonly string[]
  readonly completedQuestionKeys: readonly string[]
  readonly failedQuestionKeys: readonly string[]
  readonly currentQuestionKey: string | null
  readonly questionCount: number
  readonly progress: number
  readonly unresolved: readonly CampfitV3FactKey[]
  readonly conflicts: readonly CampfitV3Conflict[]
}

export type CampfitV3TranscriptMessage = {
  readonly role: "assistant" | "user"
  readonly content: string
  readonly questionKey?: string | undefined
}

export type CampfitV3BasicInfo = {
  readonly childAges: readonly number[]
  readonly departureWindow: string
  readonly durationWeeks: number
  readonly budgetMinKrw: number
  readonly budgetMaxKrw: number
  readonly adultCount: number
  /** Total children traveling with the adults, including children not joining the camp. */
  readonly childCount: number
  readonly guardianStaysNearby: true
}

export type CampfitV3QuickReply = {
  readonly key: string
  readonly label: string
}

export type CampfitV3FallbackReason =
  | "timeout"
  | "network_error"
  | "invalid_request"
  | "permission_denied"
  | "model_not_found"
  | "rate_limited"
  | "provider_cancelled"
  | "provider_internal"
  | "provider_unavailable"
  | "empty_response"
  | "json_parse_failed"
  | "schema_validation_failed"
  | "semantic_validation_failed"
  | "unknown_provider_error"
  | "target_slot_not_updated"
  | null

export type CampfitV3AiDiagnostics = {
  readonly providerCallAttempted: boolean
  readonly providerResponseReceived: boolean
  readonly providerResponseValidated: boolean
  readonly aiUsed: boolean
  readonly fallbackReason: CampfitV3FallbackReason
  readonly providerHttpStatus: number | null
  readonly providerErrorStatus: string | null
  readonly providerRequestCount: number
  readonly elapsedMs: number
  readonly errorName?: string | null | undefined
  readonly errorMessage?: string | null | undefined
  readonly causeName?: string | null | undefined
  readonly causeCode?: string | null | undefined
  readonly causeErrno?: string | number | null | undefined
  readonly causeSyscall?: string | null | undefined
  readonly causeHostname?: string | null | undefined
  readonly causeMessage?: string | null | undefined
}

export type CampfitV3AcknowledgementEvidence = {
  readonly factKey: CampfitV3FactKey
  readonly source: CampfitV3FactSource
  readonly evidence: string
}

export type CampfitV3ConversationResponse = {
  readonly assistantMessage: string
  readonly acknowledgementEvidence?: readonly CampfitV3AcknowledgementEvidence[] | undefined
  readonly updatedState: CampfitV3ConversationState
  readonly updatedBasicInfo: CampfitV3BasicInfo
  readonly quickReplies: readonly CampfitV3QuickReply[]
  readonly questionKey: string | null
  readonly progress: number
  readonly progressMessage: string
  readonly readyForRecommendation: boolean
  readonly conflicts: readonly CampfitV3Conflict[]
  readonly warnings: readonly string[]
  readonly aiUsed: boolean
  readonly diagnostics?: CampfitV3AiDiagnostics | undefined
}

export type ExperienceDirectionKey = "schoolSchooling" | "englishIntensive" | "subjectProject" | "cultureActivity"
export type ExperienceGoalStrength = "primary" | "secondary" | "mentioned" | "none"

export type CampfitV3ExperienceDirection = {
  readonly key: ExperienceDirectionKey
  readonly label: string
  readonly fitLabel: "가장 잘 맞는 방향" | "함께 검토할 방향" | "조건을 조정하면 가능" | "현재 우선순위가 낮음"
  readonly score: number
  readonly explanation: string
}

export type CampfitV3CostEstimate = {
  readonly estimatedTotalMinKrw: number | null
  readonly estimatedTotalMaxKrw: number | null
  readonly includedComponents: readonly string[]
  readonly missingComponents: readonly string[]
  readonly confidence: "low" | "medium" | "high"
  readonly label: "체류 비용 참고"
}

export type CampfitV3DestinationRecommendation = {
  readonly cityId: string
  readonly cityName: string
  readonly citySlug?: string | null | undefined
  readonly countryName: string
  readonly role: "가장 균형 잡힌 선택" | "원래 희망을 가장 잘 살리는 선택" | "비용·부모 체류 관점의 대안"
  readonly imageUrl: string | null
  readonly reason: string
  readonly verify: readonly string[]
  readonly costEstimate: CampfitV3CostEstimate
  readonly cityStayFlightCostKrw?: number | null | undefined
  readonly cityStayMonthlyCostKrw?: number | null | undefined
  readonly singleFlightCostKrw?: number | null | undefined
  readonly livingCostMonthlyKrw?: number | null | undefined
  readonly housingCostMonthlyKrw?: number | null | undefined
  readonly description?: string | null | undefined
  /** Short comparison note derived from the selected catalog cities. */
  readonly comparisonNote?: string | null | undefined
  readonly bullets?: readonly string[] | undefined
  readonly tripCost?: CampfitV3TripCost | undefined
}

export type CampfitV3ProgramCandidate = {
  readonly programId: string
  readonly name: string
  readonly cityName: string
  readonly countryName: string
  readonly imageUrl: string | null
  readonly ageLabel: string
  readonly durationLabel: string
  readonly priceLabel: string
  /** Short catalog-backed introduction; absent when the catalog has no description. */
  readonly description?: string | null | undefined
  readonly primaryDirection: string
  readonly reason: string
  /** Personalized match evidence shown as secondary good points on the result card. */
  readonly matchHighlights?: readonly string[] | undefined
  /** At most one concise, user-readable trade-off for this candidate. */
  readonly tradeoff?: string | undefined
  readonly verify: readonly string[]
  readonly englishRequirementLevel?: "no_requirement" | "beginner_friendly" | "general_english" | "academic_english" | "unknown" | undefined
  readonly englishRequirementSource?: "official" | "inferred" | "demo_fixture" | "unknown" | undefined
  readonly englishMatchStatus?: "comfortable" | "manageable_with_support" | "english_burden_possible" | "official_requirement_mismatch" | "unknown" | undefined
  readonly englishMatchLabel?: string | undefined
  readonly englishMatchExplanation?: string | undefined
  readonly detailUrl: string | null
  readonly group: "우선 살펴볼 프로그램" | "조건 확인 후 살펴볼 프로그램" | "함께 비교할 대안"
  readonly score: number
  readonly tripCost?: CampfitV3TripCost | undefined
}

export type CampfitV3RecommendationResult = {
  readonly consultingConclusion: string
  readonly experienceDirections: readonly CampfitV3ExperienceDirection[]
  readonly destinationRecommendations: readonly CampfitV3DestinationRecommendation[]
  readonly requiredSupportConditions: readonly string[]
  readonly programCandidates: readonly CampfitV3ProgramCandidate[]
  readonly verificationChecklist: readonly string[]
  readonly alternatives: readonly string[]
  readonly limitedResult: boolean
  readonly catalogSource: "supabase" | "demo" | "unavailable"
}
import type { CampfitV3TripCost } from "@/lib/campfit/v3/cost/types"
