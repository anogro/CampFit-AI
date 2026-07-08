import { z } from "zod"
import { AIExtractionResultSchema, DynamicQuestionSchema, NaturalConsultationInputSchema, RequiredIntakeSchema } from "@/lib/campfit/v2/schemas"
import type { AIExtractionResult, DynamicQuestion, NaturalConsultationInput, ProfileConflict, RequiredIntake } from "@/types/campfitV2"

export const QuestionBankRowSchema = z.object({
  id: z.string().uuid(),
  question_key: z.string().min(1),
  priority: z.number().int(),
  question_type: z.enum(["single_choice", "multi_choice", "number", "text"]),
  title: z.string().min(1),
  helper_text: z.string().nullable(),
  placeholder: z.string().nullable(),
  example_text: z.string().nullable(),
  options: z.unknown(),
}).strict()

export const DynamicQuestionRowSchema = z.object({
  id: z.string().uuid(),
  question_key: z.string().min(1),
  priority: z.number().int(),
  reason: z.string().nullable(),
  question_snapshot: z.unknown(),
}).strict()

export const DynamicAnswerRowSchema = z.object({
  question_key: z.string().min(1),
  answer: z.unknown(),
  answer_text: z.string().nullable(),
}).strict()

export const SessionRowSchema = z.object({ id: z.string().uuid() }).strict()

export const RequiredIntakeRowSchema = z.object({
  child_age_at_start: z.number().int(),
  departure_window: z.string(),
  duration_weeks_min: z.number().int().nullable(),
  duration_weeks_max: z.number().int().nullable(),
  total_budget_all_in_krw_min: z.number().int().nullable(),
  total_budget_all_in_krw_max: z.number().int().nullable(),
  budget_scope: z.string(),
  child_count: z.number().int(),
  parent_count: z.number().int(),
  sibling_count: z.number().int(),
  preferred_region_groups: z.array(z.string()),
  region_priority: z.string(),
  parent_accompaniment_mode: z.string(),
  korean_support_need: z.string(),
  accommodation_preferences: z.array(z.string()),
  raw_answers: z.unknown(),
}).strict()

export const NaturalInputRowSchema = z.object({
  situation_text: z.string(),
  child_context_text: z.string().nullable(),
  success_and_concerns_text: z.string().nullable(),
  additional_notes: z.string().nullable(),
}).strict()

export const AIExtractionRowSchema = z.object({
  extracted_profile: z.unknown(),
  missing_slots: z.unknown(),
  conflicts: z.unknown(),
  confidence_map: z.unknown(),
  recommended_question_keys: z.array(z.string()),
}).strict()

export function normalizeExtraction(value: z.infer<typeof AIExtractionResultSchema>): AIExtractionResult {
  return {
    extractedProfile: value.extractedProfile,
    missingSlots: value.missingSlots,
    conflicts: value.conflicts.map((conflict): ProfileConflict => ({
      conflictKey: conflict.conflictKey,
      description: conflict.description,
      severity: conflict.severity,
      ...(conflict.recommendedQuestionKey === undefined ? {} : { recommendedQuestionKey: conflict.recommendedQuestionKey }),
    })),
    confidenceMap: value.confidenceMap,
    recommendedQuestionKeys: value.recommendedQuestionKeys,
    understandingSummaryForUser: value.understandingSummaryForUser,
  }
}

export function normalizeDynamicQuestion(value: z.infer<typeof DynamicQuestionSchema>): DynamicQuestion {
  return {
    questionKey: value.questionKey,
    title: value.title,
    ...(value.helperText === undefined ? {} : { helperText: value.helperText }),
    questionType: value.questionType,
    options: value.options.map((option) => ({
      value: option.value,
      label: option.label,
      ...(option.score === undefined ? {} : { score: option.score }),
    })),
    reason: value.reason,
    priority: value.priority,
  }
}

export function normalizeRequiredIntake(value: z.infer<typeof RequiredIntakeSchema>): RequiredIntake {
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

export function normalizeNaturalInput(value: z.infer<typeof NaturalConsultationInputSchema>): NaturalConsultationInput {
  return {
    situationText: value.situationText,
    ...(value.childContextText === undefined ? {} : { childContextText: value.childContextText }),
    ...(value.successAndConcernsText === undefined ? {} : { successAndConcernsText: value.successAndConcernsText }),
    ...(value.additionalNotes === undefined ? {} : { additionalNotes: value.additionalNotes }),
  }
}

export function toRequiredIntakeRow(sessionId: string, value: RequiredIntake) {
  return {
    session_id: sessionId,
    child_age_at_start: value.childAgeAtStart,
    departure_window: value.departureWindow,
    duration_weeks_min: value.durationWeeksMin ?? null,
    duration_weeks_max: value.durationWeeksMax ?? null,
    total_budget_all_in_krw_min: value.totalBudgetAllInKrwMin ?? null,
    total_budget_all_in_krw_max: value.totalBudgetAllInKrwMax ?? null,
    budget_scope: value.budgetScope,
    child_count: value.travelerCounts.child,
    parent_count: value.travelerCounts.parent,
    sibling_count: value.travelerCounts.sibling,
    preferred_region_groups: value.preferredRegionGroups,
    region_priority: value.regionPriority,
    parent_accompaniment_mode: value.parentAccompanimentMode,
    korean_support_need: value.koreanSupportNeed,
    accommodation_preferences: value.accommodationPreferences,
    raw_answers: value.rawAnswers ?? {},
  }
}

export function toNaturalInputRow(sessionId: string, value: NaturalConsultationInput) {
  return {
    session_id: sessionId,
    situation_text: value.situationText,
    child_context_text: value.childContextText ?? null,
    success_and_concerns_text: value.successAndConcernsText ?? null,
    additional_notes: value.additionalNotes ?? null,
  }
}
