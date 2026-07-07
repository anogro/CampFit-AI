import { z } from "zod"
import {
  accommodationPreferences,
  budgetScopes,
  departureWindows,
  koreanSupportNeeds,
  parentAccompanimentModes,
  questionTypes,
  recommendationTiers,
  regionGroups,
  regionPriorities,
} from "@/types/campfitV2"

const NonNegativeIntegerSchema = z.number().int().min(0)
const JsonObjectSchema = z.record(z.string(), z.unknown())
const OptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  score: z.number().int().min(1).max(5).optional(),
})

export const RequiredIntakeSchema = z.object({
  childAgeAtStart: z.number().int().min(3).max(18),
  departureWindow: z.enum(departureWindows),
  durationWeeksMin: NonNegativeIntegerSchema.optional(),
  durationWeeksMax: NonNegativeIntegerSchema.optional(),
  totalBudgetAllInKrwMin: NonNegativeIntegerSchema.optional(),
  totalBudgetAllInKrwMax: NonNegativeIntegerSchema.optional(),
  budgetScope: z.enum(budgetScopes),
  travelerCounts: z
    .object({
      child: z.number().int().min(1),
      parent: NonNegativeIntegerSchema,
      sibling: NonNegativeIntegerSchema,
    })
    .strict(),
  preferredRegionGroups: z.array(z.enum(regionGroups)).min(1),
  regionPriority: z.enum(regionPriorities),
  parentAccompanimentMode: z.enum(parentAccompanimentModes),
  koreanSupportNeed: z.enum(koreanSupportNeeds),
  accommodationPreferences: z.array(z.enum(accommodationPreferences)),
  rawAnswers: JsonObjectSchema.optional(),
})
  .strict()
  .superRefine((value, context) => {
    if (
      value.durationWeeksMin !== undefined &&
      value.durationWeeksMax !== undefined &&
      value.durationWeeksMin > value.durationWeeksMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationWeeksMax"],
        message: "durationWeeksMax must be greater than or equal to durationWeeksMin.",
      })
    }

    if (
      value.totalBudgetAllInKrwMin !== undefined &&
      value.totalBudgetAllInKrwMax !== undefined &&
      value.totalBudgetAllInKrwMin > value.totalBudgetAllInKrwMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalBudgetAllInKrwMax"],
        message: "totalBudgetAllInKrwMax must be greater than or equal to totalBudgetAllInKrwMin.",
      })
    }
  })

export const NaturalConsultationInputSchema = z.object({
  situationText: z.string().min(10).max(4000),
  childContextText: z.string().max(2000).optional(),
  successAndConcernsText: z.string().max(2000).optional(),
  additionalNotes: z.string().max(2000).optional(),
}).strict()

export const CreateV2SessionSchema = z
  .object({
    anonymousSessionId: z.string().min(1).max(120).optional(),
    requiredIntake: RequiredIntakeSchema,
    naturalInput: NaturalConsultationInputSchema.optional(),
  })
  .strict()

const MissingSlotSchema = z
  .object({
    slotKey: z.string().min(1),
    reason: z.string().min(1),
    importance: z.enum(["high", "medium", "low"]),
  })
  .strict()

const ProfileConflictSchema = z
  .object({
    conflictKey: z.string().min(1),
    description: z.string().min(1),
    severity: z.enum(["high", "medium", "low"]),
    recommendedQuestionKey: z.string().min(1).optional(),
  })
  .strict()

export const AIExtractionResultSchema = z
  .object({
    extractedProfile: JsonObjectSchema,
    missingSlots: z.array(MissingSlotSchema),
    conflicts: z.array(ProfileConflictSchema),
    confidenceMap: z.record(z.string(), z.number().min(0).max(1)),
    recommendedQuestionKeys: z.array(z.string().min(1)),
    understandingSummaryForUser: z.string().min(1),
  })
  .strict()

export const DynamicQuestionSchema = z
  .object({
    questionKey: z.string().min(1),
    title: z.string().min(1),
    helperText: z.string().min(1).optional(),
    questionType: z.enum(questionTypes),
    options: z.array(OptionSchema),
    reason: z.string().min(1),
    priority: z.number().int().min(0),
  })
  .strict()

export const DynamicAnswerSchema = z
  .object({
    questionKey: z.string().min(1),
    answer: z.unknown(),
    answerText: z.string().min(1).optional(),
  })
  .strict()

export const BudgetEstimateSchema = z
  .object({
    regionGroup: z.enum(regionGroups),
    availableProgramBudgetKrwMin: NonNegativeIntegerSchema.optional(),
    availableProgramBudgetKrwMax: NonNegativeIntegerSchema.optional(),
    flags: z.array(z.enum(["unknown_cost_assumption", "comparison_estimate", "needs_consultation_check"])),
    note: z.string().min(1),
  })
  .strict()

export const ConsultingProfileSchema = z
  .object({
    hardConstraints: JsonObjectSchema,
    strongPreferences: JsonObjectSchema,
    softPreferences: JsonObjectSchema,
    childReadiness: JsonObjectSchema,
    parentIntent: JsonObjectSchema,
    riskProfile: JsonObjectSchema,
    flexibility: JsonObjectSchema,
    budgetEstimates: z.array(BudgetEstimateSchema),
    recommendationStrategy: z.string().min(1).optional(),
    legacyParentInput: JsonObjectSchema.optional(),
    legacyParentAnalysis: JsonObjectSchema.optional(),
  })
  .strict()

const RecommendationCardSchema = z
  .object({
    programId: z.string().min(1),
    programName: z.string().min(1),
    tier: z.enum(recommendationTiers),
    fitSummary: z.string().min(1),
    matchedConditions: z.array(z.string().min(1)),
    mismatchedConditions: z.array(z.string().min(1)),
    recommendDespiteMismatchReason: z.string().min(1).optional(),
    childFit: z.string().min(1),
    familyFit: z.string().min(1),
    riskLevel: z.enum(["low", "medium", "high"]),
    riskReasons: z.array(z.string().min(1)),
    mitigation: z.array(z.string().min(1)),
    consultingChecklist: z.array(z.string().min(1)),
  })
  .strict()

const ExcludedCandidateSchema = z
  .object({
    programId: z.string().min(1),
    programName: z.string().min(1),
    excludedReasons: z.array(z.string().min(1)),
    conditionRelaxation: z.array(z.string().min(1)),
    stillWorthConsideringReason: z.string().min(1).optional(),
  })
  .strict()

export const RecommendationReportSchema = z
  .object({
    familySummary: z.string().min(1),
    childReadinessSummary: z.string().min(1),
    recommendedProgramModes: z.array(z.string().min(1)),
    recommendations: z.array(RecommendationCardSchema),
    excludedCandidates: z.array(ExcludedCandidateSchema),
    conditionRelaxationSuggestions: z.array(z.string().min(1)),
    consultingChecklist: z.array(z.string().min(1)),
  })
  .strict()
