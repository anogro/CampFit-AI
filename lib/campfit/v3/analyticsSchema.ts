import { z } from "zod"

const uuid = z.string().uuid()
const optionalUuid = uuid.nullable().default(null)
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().default(null)

export const campfitV3AnalyticsEventNames = [
  "campfit_opened",
  "campfit_started",
  "campfit_intake_submitted",
  "campfit_conversation_started",
  "campfit_question_answered",
  "campfit_recommendation_requested",
  "campfit_recommendation_completed",
  "campfit_result_viewed",
  "campfit_city_clicked",
  "campfit_program_clicked",
  "campfit_report_action",
  "campfit_back_to_chat",
  "campfit_restart",
  "campfit_heartbeat",
] as const

const recommendationSchema = z.object({
  itemType: z.enum(["city", "program"]),
  itemId: z.string().trim().min(1).max(160),
  itemNameSnapshot: z.string().trim().min(1).max(240),
  cityId: optionalText(160),
  cityNameSnapshot: optionalText(160),
  countryNameSnapshot: optionalText(160),
  itemRank: z.number().int().min(1).max(20),
})

export const CampfitV3AnalyticsEventSchema = z.object({
  eventId: uuid,
  visitId: optionalUuid,
  journeyId: optionalUuid,
  handoffId: optionalUuid,
  eventName: z.enum(campfitV3AnalyticsEventNames),
  mode: z.enum(["production", "demo"]),
  sourceApp: z.literal("campfit").default("campfit"),
  stage: optionalText(40),
  questionKey: optionalText(80),
  questionIndex: z.number().int().min(0).max(20).nullable().default(null),
  progress: z.number().finite().min(0).max(100).nullable().default(null),
  resultId: optionalUuid,
  itemType: z.enum(["city", "program"]).nullable().default(null),
  itemId: optionalText(160),
  itemNameSnapshot: optionalText(240),
  cityId: optionalText(160),
  cityNameSnapshot: optionalText(160),
  countryNameSnapshot: optionalText(160),
  itemRank: z.number().int().min(1).max(20).nullable().default(null),
  linkTarget: optionalText(80),
  action: optionalText(80),
  answerKind: z.enum(["quick_reply", "free_text", "edit_basic"]).nullable().default(null),
  catalogSource: z.enum(["supabase", "demo", "unavailable"]).nullable().default(null),
  limitedResult: z.boolean().nullable().default(null),
  cityRecommendations: z.array(recommendationSchema).max(3).default([]),
  programRecommendations: z.array(recommendationSchema).max(9).default([]),
  metadata: z.record(z.string().trim().min(1).max(60), z.union([
    z.string().max(160),
    z.number().finite(),
    z.boolean(),
  ])).default({}),
  occurredAt: z.string().datetime().nullable().default(null),
}).superRefine((value, context) => {
  if (value.visitId === null && value.journeyId === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["journeyId"], message: "visitId or journeyId is required" })
  }

  const journeyRequiredEvents = new Set([
    "campfit_started",
    "campfit_intake_submitted",
    "campfit_conversation_started",
    "campfit_question_answered",
    "campfit_recommendation_requested",
    "campfit_recommendation_completed",
    "campfit_result_viewed",
    "campfit_city_clicked",
    "campfit_program_clicked",
    "campfit_report_action",
    "campfit_back_to_chat",
    "campfit_restart",
    "campfit_heartbeat",
  ])
  if (journeyRequiredEvents.has(value.eventName) && value.journeyId === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["journeyId"], message: "journeyId is required after CampFit starts" })
  }

  if (value.eventName === "campfit_recommendation_completed" && value.resultId === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["resultId"], message: "resultId is required for recommendation results" })
  }
})

export type CampfitV3AnalyticsEvent = z.infer<typeof CampfitV3AnalyticsEventSchema>
