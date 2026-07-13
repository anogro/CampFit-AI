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
  "parentEnglishCommunication",
  "isFirstOverseasEducationExperience",
  "dayProgramSeparationReadiness",
  "preferredActivities",
  "experienceGoals",
  "preferredRegions",
  "regionImportance",
  "koreanSupportNeed",
  "parentCommunicationNeed",
  "beginnerSupportNeed",
  "initialAdaptationSupportNeed",
  "parentStayGoals",
  "specialCareFollowUp",
  "studyOnlyAvoidance",
] as const
export type CampfitV3FactKey = (typeof campfitV3FactKeys)[number]

export type CampfitV3Fact = {
  readonly key: CampfitV3FactKey
  readonly subject: CampfitV3FactSubject
  readonly value: unknown
  readonly source: CampfitV3FactSource
  readonly confidence: number
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
  readonly currentQuestionKey: string | null
  readonly questionCount: number
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
  readonly childCount: number
  readonly guardianStaysNearby: true
}

export type CampfitV3QuickReply = {
  readonly key: string
  readonly label: string
}

export type CampfitV3ConversationResponse = {
  readonly assistantMessage: string
  readonly updatedState: CampfitV3ConversationState
  readonly quickReplies: readonly CampfitV3QuickReply[]
  readonly questionKey: string | null
  readonly progress: number
  readonly progressMessage: string
  readonly readyForRecommendation: boolean
  readonly conflicts: readonly CampfitV3Conflict[]
  readonly warnings: readonly string[]
  readonly aiUsed: boolean
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
  readonly label: "비교용 추정"
}

export type CampfitV3DestinationRecommendation = {
  readonly cityId: string
  readonly cityName: string
  readonly countryName: string
  readonly role: "가장 균형 잡힌 선택" | "원래 희망을 가장 잘 살리는 선택" | "비용·부모 체류 관점의 대안"
  readonly imageUrl: string | null
  readonly reason: string
  readonly verify: readonly string[]
  readonly costEstimate: CampfitV3CostEstimate
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
  readonly primaryDirection: string
  readonly reason: string
  readonly verify: readonly string[]
  readonly detailUrl: string | null
  readonly group: "우선 살펴볼 프로그램" | "조건 확인 후 살펴볼 프로그램" | "함께 비교할 대안"
  readonly score: number
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
}
