import { z } from "zod"
import { campfitV3FactKeys, campfitV3FactSources, campfitV3FactSubjects } from "@/types/campfitV3"

export const CampfitV3BasicInfoSchema = z
  .object({
    childAges: z.array(z.number().int().min(5).max(12)).min(1).max(5),
    departureWindow: z.string().trim().min(2).max(80),
    durationWeeks: z.number().int().min(1).max(4),
    budgetMinKrw: z.number().int().nonnegative(),
    budgetMaxKrw: z.number().int().positive(),
    adultCount: z.number().int().min(1).max(8),
    childCount: z.number().int().min(1).max(5),
    guardianStaysNearby: z.literal(true),
  })
  .superRefine((value, context) => {
    if (value.childCount !== value.childAges.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["childCount"], message: "아이 수와 나이 입력 수가 같아야 합니다." })
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
  evidence: z.string().max(240),
  updatedAt: z.string().datetime(),
})

export const CampfitV3ConversationStateSchema = z.object({
  facts: z.record(CampfitV3FactSchema),
  askedQuestionKeys: z.array(z.string().min(1).max(80)).max(10),
  currentQuestionKey: z.string().min(1).max(80).nullable(),
  questionCount: z.number().int().min(0).max(10),
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
    }),
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
  quickReplies: z.array(z.object({ key: z.string().min(1).max(80), label: z.string().min(1).max(200) })).max(12),
  questionKey: z.string().min(1).max(80).nullable(),
  progress: z.number().min(0).max(100),
  progressMessage: z.string().min(1).max(240),
  readyForRecommendation: z.boolean(),
  conflicts: z.array(z.object({ key: z.enum(campfitV3FactKeys), reason: z.string().max(240) })).max(20),
  warnings: z.array(z.string().max(300)).max(10),
  aiUsed: z.boolean(),
})

const CampfitV3CostEstimateSchema = z.object({
  estimatedTotalMinKrw: z.number().nonnegative().nullable(),
  estimatedTotalMaxKrw: z.number().nonnegative().nullable(),
  includedComponents: z.array(z.string().max(100)).max(20),
  missingComponents: z.array(z.string().max(100)).max(20),
  confidence: z.enum(["low", "medium", "high"]),
  label: z.literal("비교용 추정"),
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
  })).max(3),
  requiredSupportConditions: z.array(z.string()).max(30),
  programCandidates: z.array(z.object({
    programId: z.string().min(1), name: z.string().min(1), cityName: z.string().min(1), countryName: z.string().min(1),
    imageUrl: z.string().nullable(), ageLabel: z.string(), durationLabel: z.string(), priceLabel: z.string(), primaryDirection: z.string(),
    reason: z.string(), verify: z.array(z.string()), detailUrl: z.string().nullable(),
    group: z.enum(["우선 살펴볼 프로그램", "조건 확인 후 살펴볼 프로그램", "함께 비교할 대안"]), score: z.number().min(0).max(100),
  })).max(3),
  verificationChecklist: z.array(z.string()).max(50),
  alternatives: z.array(z.string()).max(20),
  limitedResult: z.boolean(),
})

export const CampfitV3RecommendRequestSchema = z.object({
  transcript: CampfitV3TranscriptSchema,
  finalState: CampfitV3ConversationStateSchema,
  basicInfo: CampfitV3BasicInfoSchema,
})
