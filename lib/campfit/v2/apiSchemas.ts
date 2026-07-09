import { z } from "zod"
import { CreateV2SessionSchema, DynamicAnswerSchema } from "@/lib/campfit/v2/schemas"
import type { NaturalConsultationInput, RequiredIntake } from "@/types/campfitV2"

const SessionIdSchema = z.object({ sessionId: z.string().uuid() }).strict()

export const AnalyzeV2RequestSchema = SessionIdSchema

export const RecommendV2RequestSchema = SessionIdSchema

const AnswerPayloadSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.object({ value: z.string().optional(), values: z.array(z.string()).optional(), score: z.number().optional() }).strict(),
])

export const AnswerV2ItemSchema = DynamicAnswerSchema.extend({
  dynamicQuestionId: z.string().uuid(),
  answer: AnswerPayloadSchema,
}).strict()

export const AnswersV2RequestSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(AnswerV2ItemSchema).min(1),
}).strict()

export const StrictCreateV2SessionSchema = CreateV2SessionSchema.extend({
  naturalInput: CreateV2SessionSchema.shape.naturalInput.unwrap(),
}).strict()

export function toRequiredIntake(value: z.infer<typeof StrictCreateV2SessionSchema>["requiredIntake"]): RequiredIntake {
  return {
    childAgeAtStart: value.childAgeAtStart,
    departureWindow: value.departureWindow,
    ...(value.durationWeeksMin === undefined ? {} : { durationWeeksMin: value.durationWeeksMin }),
    ...(value.durationWeeksMax === undefined ? {} : { durationWeeksMax: value.durationWeeksMax }),
    ...(value.totalBudgetAllInKrwMin === undefined ? {} : { totalBudgetAllInKrwMin: value.totalBudgetAllInKrwMin }),
    ...(value.totalBudgetAllInKrwMax === undefined ? {} : { totalBudgetAllInKrwMax: value.totalBudgetAllInKrwMax }),
    budgetScope: value.budgetScope,
    travelerCounts: value.travelerCounts,
    preferredRegionGroups: value.preferredRegionGroups,
    regionPriority: value.regionPriority,
    parentAccompanimentMode: value.parentAccompanimentMode,
    koreanSupportNeed: value.koreanSupportNeed,
    accommodationPreferences: value.accommodationPreferences,
    ...(value.rawAnswers === undefined ? {} : { rawAnswers: value.rawAnswers }),
  }
}

export function toNaturalInput(value: z.infer<typeof StrictCreateV2SessionSchema>["naturalInput"]): NaturalConsultationInput {
  return {
    situationText: value.situationText,
    ...(value.childContextText === undefined ? {} : { childContextText: value.childContextText }),
    ...(value.successAndConcernsText === undefined ? {} : { successAndConcernsText: value.successAndConcernsText }),
    ...(value.additionalNotes === undefined ? {} : { additionalNotes: value.additionalNotes }),
  }
}

const forbiddenLegacyFieldNames = [
  "grade",
  "schoolGrade",
  "gradeLevel",
  "budgetIncludesFlight",
  "budget_includes_flight",
  "flightIncludedInBudget",
] as const

export function findForbiddenLegacyField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenLegacyField(item)
      if (found !== null) return found
    }
    return null
  }

  if (!isRecord(value)) {
    return null
  }

  for (const key of Object.keys(value)) {
    if (forbiddenLegacyFieldNames.some((field) => field === key)) {
      return key
    }

    const found = findForbiddenLegacyField(value[key])
    if (found !== null) return found
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
