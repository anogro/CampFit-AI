import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3RecommendationResult,
  CampfitV3TranscriptMessage,
} from "@/types/campfitV3"
import type { z } from "zod"
import type { CampfitV3ModelResponseSchema } from "@/lib/campfit/v3/schemas"

export type CampfitV3ModelResponse = z.infer<typeof CampfitV3ModelResponseSchema>

export type AnalyzeConversationInput = {
  readonly transcript: readonly CampfitV3TranscriptMessage[]
  readonly currentState: CampfitV3ConversationState
  readonly basicInfo: CampfitV3BasicInfo
  readonly userMessage: string
  readonly allowedQuestionKeys: readonly string[]
}

export interface CampfitV3LLMProvider {
  analyzeConversation(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null>
  generateConsultingResponse(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null>
  explainRecommendation(input: {
    readonly basicInfo: CampfitV3BasicInfo
    readonly state: CampfitV3ConversationState
    readonly deterministicResult: CampfitV3RecommendationResult
  }): Promise<string | null>
}
