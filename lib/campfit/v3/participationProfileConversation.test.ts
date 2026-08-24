import { describe, expect, it } from "vitest"
import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import type { CampfitV3LLMProvider } from "@/lib/campfit/v3/provider"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "다음 여름방학",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 7_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const fallbackProvider: CampfitV3LLMProvider = {
  analyzeConversation: async () => null,
  generateConsultingResponse: async () => null,
  explainRecommendation: async () => null,
}

describe("participation profile conversation grounding", () => {
  it("stores multiple child participation signals in one turn and acknowledges them once", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "처음에는 낯을 좀 가리는데 친해지면 잘 놀아요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    const profile = response.updatedState.facts.participationProfile?.value as Record<string, unknown>
    expect(profile).toBeTruthy()
    expect((profile["peer_interaction_style"] as Record<string, unknown>)["level"]).toBe("initially_cautious_after_warm_up")
    expect(response.acknowledgementEvidence?.map((item) => item.factKey)).toContain("participationProfile")
    expect(response.assistantMessage).toContain("처음에는 적응할 시간이 조금 필요하지만")
  })

  it("keeps parent proximity preference separate from child class independence", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "처음 해외 프로그램이라 제가 가까이 있으면 좋긴 한데, 아이 자체는 혼자 수업 잘 들어갈 수 있어요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    const profile = response.updatedState.facts.participationProfile?.value as Record<string, unknown>
    expect((profile["parent_distance_comfort"] as Record<string, unknown>)["level"]).toBe("unknown")
    expect(profile["independent_class_participation"]).toBe("ready")
    expect((profile["parent_preference_evidence"] as string[]).length).toBeGreaterThan(0)
    expect(response.assistantMessage).toContain("아이 자체는 혼자 수업에 참여할 수 있고")
    expect(response.assistantMessage).not.toContain("분리")
  })

  it("does not let an ungrounded Korean-support suggestion outrank the next core question", async () => {
    const start = startConversation(basicInfo)
    const provider: CampfitV3LLMProvider = {
      ...fallbackProvider,
      analyzeConversation: async () => ({
        assistantMessage: "참여 조건을 확인했어요.",
        facts: [],
        unresolved: ["koreanSupportNeed"],
        conflicts: [],
        suggestedNextQuestionKey: "korean_support_need",
        nextAction: "ask",
        readyForRecommendation: false,
      }),
    }
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "처음 해외 프로그램이라 제가 가까이 있으면 좋긴 한데, 아이 자체는 혼자 수업 잘 들어갈 수 있어요.",
      quickReplyKey: null,
      provider,
    })
    expect(response.questionKey).not.toBe("korean_support_need")
  })

  it("does not turn a first overseas program into an English beginner signal", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "처음 해외 프로그램이라 제가 가까이 있으면 좋긴 한데, 아이 자체는 혼자 수업 잘 들어갈 수 있어요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    expect(response.updatedState.facts.childEnglishLevel).toBeUndefined()
    expect(response.updatedState.facts.englishReadiness?.value).not.toBe("support_required")
    expect(response.questionKey).not.toBe("korean_support_need")
  })
})
