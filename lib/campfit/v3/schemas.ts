import { z } from "zod"
import { CAMPFIT_V3_MAX_DURATION_WEEKS, CAMPFIT_V3_MIN_DURATION_WEEKS, campfitV3FactKeys, campfitV3FactSources, campfitV3FactStatuses, campfitV3FactSubjects } from "@/types/campfitV3"

export const CampfitV3BasicInfoSchema = z
  .object({
    childAges: z.array(z.number().int().min(5).max(12)).min(1).max(5),
    departureWindow: z.string().trim().min(2).max(80),
    durationWeeks: z.number().int().min(CAMPFIT_V3_MIN_DURATION_WEEKS).max(CAMPFIT_V3_MAX_DURATION_WEEKS),
    budgetMinKrw: z.number().int().nonnegative(),
    budgetMaxKrw: z.number().int().positive(),
    adultCount: z.number().int().min(1).max(8),
    childCount: z.number().int().min(1).max(8),
    guardianStaysNearby: z.literal(true),
  })
  .superRefine((value, context) => {
    if (value.childCount < value.childAges.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["childCount"], message: "이동하는 아이 수는 캠프 참가 아이 수보다 적을 수 없습니다." })
    }
    if (value.budgetMinKrw > value.budgetMaxKrw) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetMaxKrw"], message: "예산 범위를 다시 확인해 주세요." })
    }
  })

export const CampfitV3FactSchema = z.object({
  key: z.enum(campfitV3FactKeys),
  subject: z.enum(campfitV3FactSubjects),
  value: z.unknown(),
  source: z.enum(campfitV3FactSources),
  confidence: z.number().min(0).max(1),
  status: z.enum(campfitV3FactStatuses).default("known"),
  evidence: z.string().max(240),
  updatedAt: z.string().datetime(),
}).superRefine(validateFactContract)

export const CampfitV3ConversationStateSchema = z.object({
  facts: z.record(CampfitV3FactSchema),
  askedQuestionKeys: z.array(z.string().min(1).max(80)).max(10),
  completedQuestionKeys: z.array(z.string().min(1).max(80)).max(10).default([]),
  failedQuestionKeys: z.array(z.string().min(1).max(80)).max(10).default([]),
  currentQuestionKey: z.string().min(1).max(80).nullable(),
  questionCount: z.number().int().min(0).max(10),
  progress: z.number().min(0).max(100).default(0),
  unresolved: z.array(z.enum(campfitV3FactKeys)).max(20),
  conflicts: z.array(z.object({ key: z.enum(campfitV3FactKeys), reason: z.string().max(240) })).max(20),
})

export const CampfitV3TranscriptSchema = z.array(
  z.object({
    role: z.enum(["assistant", "user"]),
    content: z.string().trim().min(1).max(600),
    questionKey: z.string().min(1).max(80).optional(),
  }),
).max(24)

export const CampfitV3ModelResponseSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(500),
  facts: z.array(
    z.object({
      key: z.enum(campfitV3FactKeys),
      subject: z.enum(campfitV3FactSubjects),
      value: z.unknown(),
      source: z.enum(["explicit_user_statement", "ai_inference"]),
      confidence: z.number().min(0).max(1),
      evidence: z.string().trim().min(1).max(240),
    }).superRefine(validateFactContract),
  ).max(20),
  unresolved: z.array(z.enum(campfitV3FactKeys)).max(20),
  conflicts: z.array(z.object({ key: z.enum(campfitV3FactKeys), reason: z.string().max(240) })).max(20),
  suggestedNextQuestionKey: z.string().nullable(),
  nextAction: z.enum(["ask", "recommend"]),
  readyForRecommendation: z.boolean(),
})

export const CampfitV3ConversationStartRequestSchema = z.object({
  basicInfo: CampfitV3BasicInfoSchema,
})

export const CampfitV3ConversationMessageRequestSchema = z.object({
  transcript: CampfitV3TranscriptSchema,
  currentState: CampfitV3ConversationStateSchema,
  basicInfo: CampfitV3BasicInfoSchema,
  userMessage: z.string().trim().min(1).max(600),
  quickReplyKey: z.string().min(1).max(80).nullable(),
})

export const CampfitV3ConversationResponseSchema = z.object({
  assistantMessage: z.string().min(1).max(1000),
  updatedState: CampfitV3ConversationStateSchema,
  updatedBasicInfo: CampfitV3BasicInfoSchema,
  quickReplies: z.array(z.object({ key: z.string().min(1).max(80), label: z.string().min(1).max(200) })).max(12),
  questionKey: z.string().min(1).max(80).nullable(),
  progress: z.number().min(0).max(100),
  progressMessage: z.string().min(1).max(240),
  readyForRecommendation: z.boolean(),
  conflicts: z.array(z.object({ key: z.enum(campfitV3FactKeys), reason: z.string().max(240) })).max(20),
  warnings: z.array(z.string().max(300)).max(10),
  aiUsed: z.boolean(),
  diagnostics: z.object({
    providerCallAttempted: z.boolean(),
    providerResponseReceived: z.boolean(),
    providerResponseValidated: z.boolean(),
    aiUsed: z.boolean(),
    fallbackReason: z.enum([
      "timeout",
      "network_error",
      "invalid_request",
      "permission_denied",
      "model_not_found",
      "rate_limited",
      "provider_cancelled",
      "provider_internal",
      "provider_unavailable",
      "empty_response",
      "json_parse_failed",
      "schema_validation_failed",
      "semantic_validation_failed",
      "unknown_provider_error",
      "target_slot_not_updated",
    ]).nullable(),
    providerHttpStatus: z.number().int().min(100).max(599).nullable(),
    providerErrorStatus: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/).nullable(),
    providerRequestCount: z.number().int().min(0).max(2),
    elapsedMs: z.number().int().nonnegative(),
    errorName: z.string().max(120).nullable().optional(),
    errorMessage: z.string().max(240).nullable().optional(),
    causeName: z.string().max(120).nullable().optional(),
    causeCode: z.string().max(100).nullable().optional(),
    causeErrno: z.union([z.string().max(100), z.number().finite()]).nullable().optional(),
    causeSyscall: z.string().max(120).nullable().optional(),
    causeHostname: z.string().max(253).nullable().optional(),
    causeMessage: z.string().max(240).nullable().optional(),
  }).optional(),
})

const CampfitV3CostEstimateSchema = z.object({
  estimatedTotalMinKrw: z.number().nonnegative().nullable(),
  estimatedTotalMaxKrw: z.number().nonnegative().nullable(),
  includedComponents: z.array(z.string().max(100)).max(20),
  missingComponents: z.array(z.string().max(100)).max(20),
  confidence: z.enum(["low", "medium", "high"]),
  label: z.literal("비교용 추정"),
})

const CampfitV3TripCostSourceAmountSchema = z.object({
  label: z.string(),
  currency: z.string(),
  low: z.number().nonnegative().nullable(),
  high: z.number().nonnegative().nullable(),
  lowKrw: z.number().nonnegative().nullable(),
  highKrw: z.number().nonnegative().nullable(),
  exchangeRateToKrw: z.number().positive().nullable(),
  exchangeRateAsOf: z.string().nullable(),
  exchangeRateSource: z.string().nullable(),
})

const CampfitV3TripCostLineSchema = z.object({
  low: z.number().nonnegative().nullable(),
  high: z.number().nonnegative().nullable(),
  status: z.enum(["included", "exact", "partial", "estimated", "inquiry", "not_available"]),
  selectedVariant: z.string().nullable(),
  travelerCount: z.number().int().nonnegative().nullable(),
  includedItems: z.array(z.string()),
  notes: z.array(z.string()),
  sourceAmounts: z.array(CampfitV3TripCostSourceAmountSchema),
})

const CampfitV3TripCostSchema = z.object({
  currency: z.literal("KRW"),
  totalLow: z.number().nonnegative().nullable(),
  totalHigh: z.number().nonnegative().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  priceStatus: z.enum(["exact", "partial", "estimated", "inquiry"]),
  calculatedAt: z.string(),
  assumptions: z.array(z.string()),
  unresolvedItems: z.array(z.string()),
  breakdown: z.object({
    program: CampfitV3TripCostLineSchema,
    accommodation: CampfitV3TripCostLineSchema,
    flights: CampfitV3TripCostLineSchema,
    living: CampfitV3TripCostLineSchema,
    localTransport: CampfitV3TripCostLineSchema,
    other: CampfitV3TripCostLineSchema.extend({ items: z.array(z.string()) }),
  }),
})

export const CampfitV3RecommendationResultSchema = z.object({
  consultingConclusion: z.string().min(1).max(1000),
  experienceDirections: z.array(z.object({
    key: z.enum(["schoolSchooling", "englishIntensive", "subjectProject", "cultureActivity"]),
    label: z.string().min(1).max(100),
    fitLabel: z.enum(["가장 잘 맞는 방향", "함께 검토할 방향", "조건을 조정하면 가능", "현재 우선순위가 낮음"]),
    score: z.number().min(0).max(100),
    explanation: z.string().max(500),
  })).max(4),
  destinationRecommendations: z.array(z.object({
    cityId: z.string().min(1), cityName: z.string().min(1), countryName: z.string().min(1),
    role: z.enum(["가장 균형 잡힌 선택", "원래 희망을 가장 잘 살리는 선택", "비용·부모 체류 관점의 대안"]),
    imageUrl: z.string().nullable(), reason: z.string(), verify: z.array(z.string()), costEstimate: CampfitV3CostEstimateSchema,
    cityStayFlightCostKrw: z.number().nonnegative().nullable(), cityStayMonthlyCostKrw: z.number().nonnegative().nullable(), tripCost: CampfitV3TripCostSchema.optional(),
  })).max(3),
  requiredSupportConditions: z.array(z.string()).max(30),
  programCandidates: z.array(z.object({
    programId: z.string().min(1), name: z.string().min(1), cityName: z.string().min(1), countryName: z.string().min(1),
    imageUrl: z.string().nullable(), ageLabel: z.string(), durationLabel: z.string(), priceLabel: z.string(), primaryDirection: z.string(),
    reason: z.string(), verify: z.array(z.string()), detailUrl: z.string().nullable(),
    group: z.enum(["우선 살펴볼 프로그램", "조건 확인 후 살펴볼 프로그램", "함께 비교할 대안"]), score: z.number().min(0).max(100), tripCost: CampfitV3TripCostSchema.optional(),
  })).max(9),
  verificationChecklist: z.array(z.string()).max(50),
  alternatives: z.array(z.string()).max(20),
  limitedResult: z.boolean(),
  catalogSource: z.enum(["supabase", "demo", "unavailable"]),
})

export const CampfitV3RecommendRequestSchema = z.object({
  transcript: CampfitV3TranscriptSchema,
  finalState: CampfitV3ConversationStateSchema,
  basicInfo: CampfitV3BasicInfoSchema,
  demo: z.boolean().optional(),
})

const expectedSubjects: Readonly<Record<(typeof campfitV3FactKeys)[number], readonly string[]>> = {
  childEnglishLevel: ["child"],
  parentEnglishCommunication: ["parent"],
  isFirstOverseasEducationExperience: ["child"],
  dayProgramSeparationReadiness: ["child"],
  preferredActivities: ["preference"],
  destinationPreference: ["preference"],
  socialPreference: ["child", "preference"],
  desiredOutcomes: ["preference"],
  worries: ["parent", "family"],
  experienceGoals: ["preference"],
  preferredRegions: ["preference"],
  regionImportance: ["preference"],
  koreanSupportNeed: ["constraint"],
  parentCommunicationNeed: ["constraint"],
  beginnerSupportNeed: ["constraint"],
  initialAdaptationSupportNeed: ["constraint"],
  parentStayGoals: ["parent"],
  specialCareFollowUp: ["constraint"],
      studyOnlyAvoidance: ["preference"],
      budgetRangeKrw: ["constraint"],
      budgetIncludesFlight: ["constraint"],
      departureWindow: ["constraint"],
  durationWeeks: ["constraint"],
}

const goalStrengthSchema = z.enum(["primary", "secondary", "mentioned", "none"])
const valueSchemas: Readonly<Record<(typeof campfitV3FactKeys)[number], z.ZodTypeAny>> = {
  childEnglishLevel: z.enum(["beginner", "basic", "intermediate", "advanced"]),
  parentEnglishCommunication: z.enum(["possible", "limited", "not_possible"]),
  isFirstOverseasEducationExperience: z.boolean(),
  dayProgramSeparationReadiness: z.enum(["needs_close_support", "with_initial_support", "ready"]),
  preferredActivities: z.array(z.string().trim().min(1).max(80)).max(12),
  destinationPreference: z.array(z.string().trim().min(1).max(80)).max(8),
  socialPreference: z.array(z.string().trim().min(1).max(80)).max(8),
  desiredOutcomes: z.array(z.string().trim().min(1).max(120)).max(8),
  worries: z.array(z.string().trim().min(1).max(120)).max(8),
  experienceGoals: z.object({
    schoolSchooling: goalStrengthSchema,
    englishIntensive: goalStrengthSchema,
    subjectProject: goalStrengthSchema,
    cultureActivity: goalStrengthSchema,
  }),
  preferredRegions: z.array(z.enum(["southeast_asia", "oceania", "north_america", "europe"])).max(4),
  regionImportance: z.enum(["must", "strong", "soft", "no_preference"]),
  koreanSupportNeed: z.enum(["must_daily", "emergency_only", "preferred", "none"]),
  parentCommunicationNeed: z.enum(["daily", "issue_only", "occasional", "not_important"]),
  beginnerSupportNeed: z.boolean(),
  initialAdaptationSupportNeed: z.boolean(),
  parentStayGoals: z.array(z.enum(["restWellness", "cafeDining", "tourismCulture", "natureBeach", "remoteWork", "childScheduleFirst"])).max(6),
  specialCareFollowUp: z.enum(["none", "required", "unknown"]),
  studyOnlyAvoidance: z.boolean(),
  budgetRangeKrw: z.object({ min: z.number().int().nonnegative(), max: z.number().int().positive() }).refine((value) => value.min <= value.max),
  budgetIncludesFlight: z.boolean(),
  departureWindow: z.string().trim().min(2).max(80),
  durationWeeks: z.number().int().min(CAMPFIT_V3_MIN_DURATION_WEEKS).max(CAMPFIT_V3_MAX_DURATION_WEEKS),
}

function validateFactContract(
  value: { readonly key: (typeof campfitV3FactKeys)[number]; readonly subject: string; readonly value?: unknown },
  context: z.RefinementCtx,
): void {
  if (!expectedSubjects[value.key].includes(value.subject)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["subject"], message: "fact subject does not match its key" })
  }
  if (!Object.prototype.hasOwnProperty.call(value, "value") || !valueSchemas[value.key].safeParse(value.value).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "fact value does not match its key" })
  }
}
