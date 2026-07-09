import type { AIExtractionResult, DynamicQuestion, NaturalConsultationInput, RecommendationReportV2, RequiredIntake } from "@/types/campfitV2"

export type CampFitV2Step = "required_intake" | "natural_input" | "ai_review" | "dynamic_questions" | "report"

export type MaterializedQuestionView = DynamicQuestion & {
  readonly dynamicQuestionId: string
  readonly placeholder?: string
  readonly exampleText?: string
}

export type AnalyzeV2Response = AIExtractionResult & {
  readonly aiUsed: boolean
}

export type RecommendV2Response = {
  readonly consultingProfile: unknown
  readonly report: RecommendationReportV2
  readonly recommendationRunId: string | null
}

export type CampFitV2Draft = {
  readonly requiredIntake: RequiredIntake
  readonly naturalInput: NaturalConsultationInput
}
