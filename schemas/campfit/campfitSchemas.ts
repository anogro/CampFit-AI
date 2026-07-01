import { z } from "zod"
import {
  budgetRangeOptions,
  destinationPreferenceOptions,
  durationWeekOptions,
  englishSelfLevels,
  fitTypes,
  gradeOptions,
  koreanManagerRequiredOptions,
  levelOptions,
  overseasExperienceOptions,
  parentAccompaniedOptions,
  programTypeOptions,
  supportKeys,
  travelReadinessOptions,
} from "@/types/campfit"

export const CampfitInputSchema = z.object({
  childAge: z.number().int().min(6).max(15),
  grade: z.enum(gradeOptions),
  englishSelfLevel: z.enum(englishSelfLevels),
  overseasExperience: z.enum(overseasExperienceOptions),
  shynessLevel: z.enum(levelOptions),
  separationTolerance: z.enum(levelOptions),
  budgetRange: z.enum(budgetRangeOptions),
  destinationPreference: z.enum(destinationPreferenceOptions),
  travelReadiness: z.enum(travelReadinessOptions),
  durationWeeks: z.enum(durationWeekOptions),
  parentAccompanied: z.enum(parentAccompaniedOptions),
  koreanManagerRequired: z.enum(koreanManagerRequiredOptions),
  preferredProgramType: z.enum(programTypeOptions),
  parentConcernText: z.string().min(20).max(1200),
})

const ScoreSchema = z.number().min(0).max(1)

export const ParentAnalysisSchema = z.object({
  parentType: z.string().min(1),
  parentGoal: z.object({
    englishGrowth: ScoreSchema,
    confidenceGrowth: ScoreSchema,
    independenceGrowth: ScoreSchema,
    socialGrowth: ScoreSchema,
    safetyPriority: ScoreSchema,
    academicResultPriority: ScoreSchema,
    experiencePriority: ScoreSchema,
  }),
  childProfile: z.object({
    englishReadiness: ScoreSchema,
    socialConfidence: ScoreSchema,
    separationTolerance: ScoreSchema,
    newEnvironmentAdaptability: ScoreSchema,
    challengeTolerance: ScoreSchema,
  }),
  supportNeeded: z.array(z.enum(supportKeys)).min(1).max(6),
  detectedTensions: z
    .array(
      z.object({
        type: z.enum([
          "care_vs_independence",
          "english_growth_vs_anxiety",
          "academic_result_vs_burden",
          "budget_vs_care",
          "safety_vs_challenge",
        ]),
        description: z.string().min(1),
        confidence: ScoreSchema,
      }),
    )
    .max(5),
  evidence: z
    .array(
      z.object({
        text: z.string().min(1),
        mappedTo: z.string().min(1),
        impact: z.enum(["increase", "decrease"]),
      }),
    )
    .max(6),
  summaryForParent: z.array(z.string().min(1)).min(2).max(5),
  followUpQuestions: z.array(z.string().min(1)).min(1).max(2),
})

export const AnalyzeRequestSchema = z.object({
  input: CampfitInputSchema,
})

export const ReadinessAnswersSchema = z.object({
  q1: z.enum(["A", "B", "C", "D"]),
  q2: z.enum(["A", "B", "C", "D"]),
  q3: z.enum(["A", "B", "C", "D"]),
  q4: z.enum(["A", "B", "C", "D"]),
  q5: z.string().max(200),
  q6: z.enum(["A", "B", "C", "D"]),
})

export const RecommendRequestSchema = z.object({
  sessionId: z.string().optional(),
  input: CampfitInputSchema,
  analysis: ParentAnalysisSchema,
  aiUsage: z
    .object({
      parentAnalysis: z.boolean(),
    })
    .optional(),
  followUpAnswers: z.array(z.string().max(500)).max(2),
  readinessAnswers: ReadinessAnswersSchema.optional(),
})

export const FeedbackRequestSchema = z.object({
  sessionId: z.string().min(1),
  feedback: z.enum(["good_fit", "different", "unsure", "consultation_requested"]),
  clickedCampId: z.string().optional(),
})

export const CampReadinessResultSchema = z.object({
  basicInstructionUnderstanding: ScoreSchema,
  helpRequestAbility: ScoreSchema,
  survivalExpression: ScoreSchema,
  peerInteractionReadiness: ScoreSchema,
  basicSelfExpression: ScoreSchema,
  englishAnxietySignal: ScoreSchema,
  communicationAttemptTendency: ScoreSchema,
  overallReadiness: z.enum(["early_adaptation", "basic_adaptation", "moderate_ready", "high_ready"]),
  recommendedSupport: z.array(z.enum(supportKeys)),
})

const SupportBufferSchema = z.record(z.enum(supportKeys), ScoreSchema)

const CampSchema = z.object({
  id: z.string(),
  anogroProgramId: z.string().optional(),
  anogroProgramSlug: z.string().optional(),
  name: z.string(),
  country: z.string(),
  city: z.string(),
  programType: z.enum(programTypeOptions).exclude(["unsure"]),
  ageMin: z.number(),
  ageMax: z.number(),
  budgetMinKrw: z.number(),
  budgetMaxKrw: z.number(),
  durationWeeks: z.array(z.enum(durationWeekOptions)),
  koreanManager: z.boolean(),
  parentAccompanied: z.boolean(),
  koreanDormOption: z.boolean(),
  beginnerClass: z.boolean(),
  buddySystem: z.boolean(),
  dailyParentReport: z.boolean(),
  lowPressureSpeaking: z.boolean(),
  smallGroupCare: z.boolean(),
  traits: z.array(z.string()),
  difficulty: z.object({
    englishExposure: ScoreSchema,
    boardingIndependence: ScoreSchema,
    academicIntensity: ScoreSchema,
    foreignPeerInteraction: ScoreSchema,
    parentSeparation: ScoreSchema,
  }),
  supportBuffer: SupportBufferSchema,
})

export const RecommendationResultSchema = z.object({
  sessionId: z.string(),
  analysis: ParentAnalysisSchema,
  aiUsage: z.object({
    parentAnalysis: z.boolean(),
    recommendationExplanation: z.boolean(),
  }),
  readiness: CampReadinessResultSchema,
  recommendations: z.array(
    z.object({
      camp: CampSchema,
      fitType: z.enum(fitTypes),
      score: z.number().int().min(0).max(100),
      explanation: z.object({
        reason: z.string(),
        caution: z.string(),
        questionsBeforeConsultation: z.array(z.string()),
      }),
      debugScores: z.object({
        goalFit: ScoreSchema,
        supportFit: ScoreSchema,
        challengeLoad: ScoreSchema,
        childReadiness: ScoreSchema,
        residualRisk: ScoreSchema,
        growthPotential: ScoreSchema,
      }),
    }),
  ),
  noCandidateMessage: z.string().optional(),
})
