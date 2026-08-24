import { describe, expect, it } from "vitest"
import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import { coreRecommendationReadiness } from "@/lib/campfit/v3/progress"
import { selectNextQuestion } from "@/lib/campfit/v3/questionBank"
import { extractDeterministicFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3LLMProvider } from "@/lib/campfit/v3/provider"
import type { CampfitV3BasicInfo, CampfitV3ConversationResponse, CampfitV3TranscriptMessage } from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "2027년 1월",
  durationWeeks: 3,
  budgetMinKrw: 8_000_000,
  budgetMaxKrw: 12_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const fallbackProvider: CampfitV3LLMProvider = {
  analyzeConversation: async () => null,
  generateConsultingResponse: async () => null,
  explainRecommendation: async () => null,
}

async function runMessages(messages: readonly string[]): Promise<CampfitV3ConversationResponse> {
  let response = startConversation(basicInfo)
  let transcript: CampfitV3TranscriptMessage[] = response.questionKey === null
    ? []
    : [{ role: "assistant", content: response.assistantMessage, questionKey: response.questionKey }]
  for (const message of messages) {
    response = await processConversationMessage({
      transcript,
      currentState: response.updatedState,
      basicInfo,
      userMessage: message,
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    transcript = [
      ...transcript,
      { role: "user", content: message, ...(response.updatedState.currentQuestionKey ? { questionKey: response.updatedState.currentQuestionKey } : {}) },
      ...(response.questionKey === null ? [] : [{ role: "assistant" as const, content: response.assistantMessage, questionKey: response.questionKey }]),
    ]
  }
  return response
}

describe("core recommendation conversation flow", () => {
  it("starts with parent experience needs and follows the four core priorities", async () => {
    const start = startConversation(basicInfo)
    expect(start.questionKey).toBe("primary_experience_goal")
    const response = await runMessages([
      "이번에는 영어도 늘고 친구들도 많이 사귀었으면 좋겠어요.",
      "영어 설명은 대충 이해하고 간단한 대답은 할 수 있어요.",
      "축구랑 과학실험을 제일 좋아해요.",
      "지역은 크게 상관없어요. 추천해주세요.",
    ])

    expect(coreRecommendationReadiness(response.updatedState)).toMatchObject({
      parentExperienceNeeds: true,
      englishReadiness: true,
      activityPreferences: true,
      preferredRegion: true,
      ready: true,
      completeCount: 4,
    })
    expect(response.readyForRecommendation).toBe(true)
    expect(response.questionKey).toBeNull()
    expect(response.progress).toBe(100)
    expect(response.updatedState.facts.parentStayGoals).toBeUndefined()
    expect(response.updatedState.facts.participationProfile).toBeUndefined()
  })

  it("extracts several core areas in one answer and asks only for the missing parent goal", async () => {
    const response = await runMessages([
      "영어로 수업은 따라갈 수 있고 질문에 대답도 할 수 있어요. 축구랑 수영을 좋아해요. 처음 보는 친구들은 조금 낯가리지만 금방 친해지고, 동남아 쪽이면 좋겠어요.",
    ])

    expect(response.updatedState.facts.childEnglishListening).toBeDefined()
    expect(response.updatedState.facts.activityPreferences).toBeDefined()
    expect(response.updatedState.facts.participationProfile).toBeDefined()
    expect(response.updatedState.facts.preferredRegions?.value).toEqual(["southeast_asia"])
    expect(coreRecommendationReadiness(response.updatedState)).toMatchObject({ completeCount: 3, parentExperienceNeeds: false })
    expect(response.questionKey).toBe("primary_experience_goal")
  })

  it("does not ask about participation when all four core areas are sufficient", async () => {
    const response = await runMessages([
      "친구들과 어울리고 자신감을 얻는 경험이 가장 중요해요.",
      "영어 설명은 이해하고 질문에도 영어로 대답할 수 있어요.",
      "축구와 과학실험을 좋아해요.",
      "뉴질랜드를 생각하고 있어요.",
    ])

    expect(response.readyForRecommendation).toBe(true)
    expect(response.updatedState.facts.participationProfile).toBeUndefined()
    expect(response.questionKey).toBeNull()
  })

  it("keeps parent goals and participation evidence separate", async () => {
    const response = await runMessages(["친구를 많이 사귀었으면 좋겠어요. 아이는 처음엔 낯가리지만 금방 잘 놀아요."])
    const needs = response.updatedState.facts.parentExperienceNeeds?.value as Record<string, { importance: string }> | undefined
    const profile = response.updatedState.facts.participationProfile?.value as Record<string, unknown> | undefined

    expect(needs?.["peer_interaction"]?.importance).toBe("important")
    expect((profile?.["peer_interaction_style"] as Record<string, unknown>)?.["level"]).toBe("initially_cautious_after_warm_up")
    expect(response.questionKey).toBe("child_english_level")
  })

  it("resolves an undecided region and does not ask it again", async () => {
    const response = await runMessages(["지역은 잘 모르겠어요. 아이에게 맞는 곳으로 추천해주세요."])
    expect(response.updatedState.facts.preferredRegions?.value).toEqual([])
    expect(response.updatedState.facts.regionImportance?.value).toBe("no_preference")
    expect(response.questionKey).toBe("primary_experience_goal")
  })

  it("keeps Korean support conditional behind the core questions", async () => {
    const response = await runMessages(["영어는 잘 못하지만 한국어 지원은 없어도 괜찮아요."])
    expect(response.updatedState.facts.koreanSupportNeed?.value).toBe("none")
    expect(response.questionKey).toBe("primary_experience_goal")
  })

  it("does not let an LLM suggested key override the deterministic priority", () => {
    const start = startConversation(basicInfo)
    expect(selectNextQuestion(start.updatedState, "preferred_region")?.key).toBe("primary_experience_goal")
  })

  it("retains English and activity sufficiency even when participation is absent", () => {
    const facts = extractDeterministicFacts("영어 설명은 이해하고 간단한 대답은 할 수 있어요. 축구를 좋아해요. 지역은 상관없어요.")
    expect(facts.find((fact) => fact.key === "childEnglishSpeaking")?.value).toBe("answers_simple_questions")
    expect(facts.find((fact) => fact.key === "activityPreferences")).toBeDefined()
    expect(facts.find((fact) => fact.key === "participationProfile")).toBeUndefined()
  })

  it("asks only for the missing speaking evidence after a broad first answer", async () => {
    const response = await runMessages([
      "영어를 늘리는 게 제일 중요하고, 영어로 간단한 수업은 따라갈 수 있어요. 수영하고 동물 보는 걸 좋아하고 처음엔 낯가리지만 적응하면 잘 놀아요. 지역은 동남아나 호주 쪽이면 좋겠어요.",
    ])

    expect(coreRecommendationReadiness(response.updatedState)).toMatchObject({
      parentExperienceNeeds: true,
      englishReadiness: false,
      activityPreferences: true,
      preferredRegion: true,
      completeCount: 3,
    })
    expect(response.questionKey).toBe("child_english_level")
    expect(response.assistantMessage).toContain("간단한 질문에 답하거나 먼저 영어로 말하는 건 어떤가요?")
    expect(response.assistantMessage).not.toContain("캠프 추천에 필요한 내용을 편하게 말씀해주세요")
    expect(response.updatedState.facts.participationProfile).toBeDefined()
  })
})
