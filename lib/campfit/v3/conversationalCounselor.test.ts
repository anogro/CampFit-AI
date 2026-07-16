import { describe, expect, it } from "vitest"
import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import { selectNextQuestion } from "@/lib/campfit/v3/questionBank"
import { calculateProgress } from "@/lib/campfit/v3/progress"
import { createFact, createInitialConversationState, extractDeterministicFacts, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"
import type { CampfitV3LLMProvider } from "@/lib/campfit/v3/provider"

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

describe("CampFit v3 conversational counselor flow", () => {
  it("extracts child English, parent English, destinations, and social preference together", () => {
    const facts = extractDeterministicFacts("아이가 영어는 거의 못하지만 사람 만나는 건 좋아하고 싱가포르나 뉴질랜드를 생각하고 있어요. 제가 영어는 가능합니다.")
    expect(facts.map((fact) => fact.key)).toEqual(expect.arrayContaining([
      "childEnglishLevel",
      "parentEnglishCommunication",
      "destinationPreference",
      "preferredRegions",
      "socialPreference",
    ]))
    expect(facts.find((fact) => fact.key === "childEnglishLevel")?.value).toBe("beginner")
    expect(facts.find((fact) => fact.key === "parentEnglishCommunication")?.value).toBe("possible")
    expect(facts.find((fact) => fact.key === "destinationPreference")?.value).toEqual(["Singapore", "New Zealand"])
    expect(facts.every((fact) => fact.status === "confirmed")).toBe(true)
  })

  it("does not infer an English outcome or Korean support from the subject-separation gate", () => {
    const facts = extractDeterministicFacts("아이는 영어가 초급이지만 저는 영어로 소통할 수 있어요.")
    expect(facts.find((fact) => fact.key === "childEnglishLevel")?.value).toBe("beginner")
    expect(facts.find((fact) => fact.key === "parentEnglishCommunication")?.value).toBe("possible")
    expect(facts.some((fact) => fact.key === "desiredOutcomes")).toBe(false)
    expect(facts.some((fact) => fact.key === "koreanSupportNeed")).toBe(false)
  })

  it("treats an English-kindergarten mention as experience, not a current level", () => {
    const facts = extractDeterministicFacts("영어유치원을 다녔어요.")
    expect(facts.find((fact) => fact.key === "childEnglishLevel")).toBeUndefined()
    expect(facts.find((fact) => fact.key === "experienceGoals")?.value).toMatchObject({ englishIntensive: "primary" })
    expect(facts.find((fact) => fact.key === "desiredOutcomes")?.value).toEqual(expect.arrayContaining(["english_exposure"]))
  })

  it("recognizes general English exposure goals without inventing a current level", () => {
    const facts = extractDeterministicFacts("영어를 계속 접하게 해주고 영어 감을 유지했으면 해요.")
    expect(facts.find((fact) => fact.key === "childEnglishLevel")).toBeUndefined()
    expect(facts.find((fact) => fact.key === "experienceGoals")?.value).toMatchObject({ englishIntensive: "primary" })
    expect(facts.find((fact) => fact.key === "desiredOutcomes")?.value).toEqual(expect.arrayContaining(["english_exposure"]))
  })

  it("keeps a project preference ahead of contrasted general-experience wording", () => {
    const facts = extractDeterministicFacts("단순 체험보다는 마지막에 결과물을 만들어 보는 프로젝트였으면 좋겠어요.")
    const goals = facts.find((fact) => fact.key === "experienceGoals")?.value as Record<string, unknown> | undefined
    expect(goals?.["subjectProject"]).toBe("primary")
    expect(goals?.["cultureActivity"]).not.toBe("primary")
  })

  it("captures four or more facts in one natural fallback turn", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "아이는 영어가 초급이고 사람을 만나는 걸 좋아해요. 싱가포르를 생각하고 있고 영어 자신감이 생기면 좋겠어요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    expect(response.aiUsed).toBe(false)
    expect(response.updatedState.facts.childEnglishLevel?.value).toBe("beginner")
    expect(response.updatedState.facts.destinationPreference?.value).toEqual(["Singapore"])
    expect(response.updatedState.facts.socialPreference?.value).toEqual(["people_and_peer_interaction"])
    expect(response.updatedState.facts.desiredOutcomes?.value).toEqual(expect.arrayContaining(["english_confidence", "peer_connection"]))
    expect(response.questionKey).not.toBe("child_english_level")
  })

  it("updates a conversational budget correction from 700 to 900", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "예산은 700만 원이 아니라 900만 원까지 가능해요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    expect(response.updatedBasicInfo.budgetMaxKrw).toBe(9_000_000)
    expect(response.updatedState.facts.budgetRangeKrw?.status).toBe("confirmed")
    expect(response.updatedState.facts.budgetRangeKrw?.source).toBe("user_correction")
  })

  it("promotes tentative information to confirmed and stops asking that question", () => {
    const tentative = createFact({ key: "childEnglishLevel", subject: "child", value: "beginner", source: "ai_inference", confidence: 0.4, evidence: "표현이 모호함" })
    const tentativeState = mergeFacts(createInitialConversationState(), [tentative])
    expect(tentativeState.facts.childEnglishLevel?.status).toBe("tentative")
    expect(selectNextQuestion(tentativeState)?.key).toBe("child_english_level")

    const confirmed = createFact({ key: "childEnglishLevel", subject: "child", value: "beginner", source: "explicit_user_statement", evidence: "초급이라고 명확히 답함" })
    const confirmedState = mergeFacts(tentativeState, [confirmed])
    expect(confirmedState.facts.childEnglishLevel?.status).toBe("confirmed")
    expect(selectNextQuestion(confirmedState)?.key).not.toBe("child_english_level")
  })

  it("uses one high-value follow-up for low confidence and does not re-ask known facts", () => {
    const lowConfidence = mergeFacts(createInitialConversationState(), [createFact({ key: "destinationPreference", subject: "preference", value: ["Singapore"], source: "ai_inference", confidence: 0.3, evidence: "도시 언급이 모호함" })])
    expect(selectNextQuestion(lowConfidence)?.key).toBe("child_english_level")

    const known = mergeFacts(lowConfidence, [createFact({ key: "childEnglishLevel", subject: "child", value: "beginner", source: "explicit_user_statement", evidence: "초급" })])
    expect(selectNextQuestion(known)?.key).not.toBe("child_english_level")
  })

  it("keeps the same multi-fact behavior when Gemini fallback returns null", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "아이는 영어를 거의 못하지만 부모인 저는 영어로 소통할 수 있고 뉴질랜드를 생각하고 있어요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    expect(response.diagnostics?.aiUsed).toBe(false)
    expect(response.updatedState.facts.childEnglishLevel?.value).toBe("beginner")
    expect(response.updatedState.facts.parentEnglishCommunication?.value).toBe("possible")
    expect(response.updatedState.facts.destinationPreference?.value).toEqual(["New Zealand"])
    expect(response.questionKey).not.toBe("child_english_level")
  })

  it("keeps partial multi-fact understanding instead of failing the opening question", async () => {
    const start = startConversation(basicInfo)
    const opening = [{
      role: "assistant" as const,
      content: start.assistantMessage,
      questionKey: start.questionKey ?? undefined,
    }]
    const userMessage = "영어유치원을 다녀서 영어를 자연스럽게 습득한 아이입니다. 초등입학 이후 영어 사용 기회가 적어서 방학을 맞아 캠프 가려고 해요. 보호자가 1명 같이 갈거고 현지에서 원격근무할 예정입니다."
    const response = await processConversationMessage({
      transcript: opening,
      currentState: start.updatedState,
      basicInfo,
      userMessage,
      quickReplyKey: null,
      provider: fallbackProvider,
    })

    expect(extractDeterministicFacts(userMessage).length).toBeGreaterThanOrEqual(3)
    expect(response.updatedState.facts.experienceGoals?.value).toMatchObject({ englishIntensive: "primary" })
    expect(response.updatedState.facts.desiredOutcomes?.value).toEqual(expect.arrayContaining(["english_exposure"]))
    expect(response.updatedState.facts.parentStayGoals?.value).toEqual(expect.arrayContaining(["remoteWork"]))
    expect(response.updatedState.facts.childEnglishLevel).toBeUndefined()
    expect(response.updatedBasicInfo.guardianStaysNearby).toBe(true)
    expect(response.updatedBasicInfo.adultCount).toBe(1)
    expect(response.updatedState.failedQuestionKeys).not.toContain("child_english_level")
    expect(response.updatedState.currentQuestionKey).toBe("child_english_level")
    expect(response.questionKey).toBe("child_english_level")
    expect(response.quickReplies.map((reply) => reply.key)).toEqual(["beginner", "basic", "intermediate", "advanced"])
    expect(response.assistantMessage).toContain("영어")
    expect(response.assistantMessage).not.toContain("내용을 확인하지 못했어요")
    expect(response.assistantMessage).not.toContain(start.assistantMessage)
    expect(response.assistantMessage.split("\n\n").length).toBe(2)
    expect(response.progress).toBe(calculateProgress(response.updatedBasicInfo, response.updatedState))
  })

  it("does not infer current English level from English-kindergarten experience alone", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [{ role: "assistant", content: start.assistantMessage, questionKey: start.questionKey ?? undefined }],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "영어유치원은 다녔지만 지금 회화 수준은 잘 모르겠어요. 엄마가 같이 가서 일할 예정이에요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })

    expect(response.updatedState.facts.childEnglishLevel).toBeUndefined()
    expect(response.updatedState.facts.experienceGoals?.value).toMatchObject({ englishIntensive: "primary" })
    expect(response.updatedState.facts.parentStayGoals?.value).toEqual(expect.arrayContaining(["remoteWork"]))
    expect(response.updatedState.failedQuestionKeys).not.toContain("child_english_level")
    expect(response.questionKey).toBe("child_english_level")
    expect(response.assistantMessage).not.toContain("내용을 확인하지 못했어요")
    expect(response.assistantMessage).not.toContain(start.assistantMessage)
  })

  it("keeps a genuinely unknown answer as one failed follow-up without duplicating the opening", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [{ role: "assistant", content: start.assistantMessage, questionKey: start.questionKey ?? undefined }],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "그냥 잘 모르겠어요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })

    expect(response.updatedState.failedQuestionKeys).toContain("child_english_level")
    expect(response.questionKey).toBe("child_english_level")
    expect(response.assistantMessage).toContain("아직 답변을 충분히 파악하지 못했어요.")
    expect(response.assistantMessage).toContain("현재 아이가 영어로 어느 정도 소통할 수 있는지만")
    expect(response.assistantMessage).not.toContain(start.assistantMessage)
    expect(response.assistantMessage.split("\n\n")).toHaveLength(2)
  })

  it("uses the same partial response when the provider times out", async () => {
    const timeoutProvider: CampfitV3LLMProvider = {
      ...fallbackProvider,
      getLastDiagnostic: () => ({
        code: "timeout",
        providerResponseReceived: false,
        httpStatus: null,
        errorStatus: null,
        repaired: false,
        requestCount: 1,
        elapsedMs: 7_000,
      }),
    }
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [{ role: "assistant", content: start.assistantMessage, questionKey: start.questionKey ?? undefined }],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "영어유치원을 다녀서 영어를 자연스럽게 습득한 아이입니다. 보호자가 같이 가서 현지에서 원격근무할 예정입니다.",
      quickReplyKey: null,
      provider: timeoutProvider,
    })

    expect(response.aiUsed).toBe(false)
    expect(response.diagnostics?.fallbackReason).toBe("timeout")
    expect(response.warnings).toContain("말씀해주신 내용을 기준으로 상담을 이어갈게요.")
    expect(response.updatedState.facts.desiredOutcomes?.value).toEqual(expect.arrayContaining(["english_exposure"]))
    expect(response.updatedState.failedQuestionKeys).not.toContain("child_english_level")
    expect(response.assistantMessage).not.toContain("내용을 확인하지 못했어요")
    expect(response.assistantMessage).not.toContain(start.assistantMessage)
  })

  it("retains the four-turn counselor context without re-asking completed facts", async () => {
    let state = startConversation(basicInfo).updatedState
    let currentBasicInfo = basicInfo
    let transcript: Array<{ role: "assistant" | "user"; content: string; questionKey?: string }> = []
    const turns = [
      "아이는 영어가 거의 처음이고 새로운 곳에서는 적응하는 데 시간이 좀 걸려요.",
      "그래도 친구를 좋아하고 로봇 만들기나 과학 실험은 정말 좋아해요.",
      "저는 영어로 기본적인 소통은 가능하고, 아이가 참여하는 동안 카페에서 일하거나 쉬고 싶어요.",
      "2주 정도 생각하고 있고 예산은 항공 포함 900만원까지예요. 싱가포르나 오클랜드가 궁금해요.",
    ] as const

    for (const turn of turns) {
      const response = await processConversationMessage({
        transcript,
        currentState: state,
        basicInfo: currentBasicInfo,
        userMessage: turn,
        quickReplyKey: null,
        provider: fallbackProvider,
      })
      const assistantTurn = response.questionKey === null
        ? { role: "assistant" as const, content: response.assistantMessage }
        : { role: "assistant" as const, content: response.assistantMessage, questionKey: response.questionKey }
      transcript = [
        ...transcript,
        { role: "user", content: turn },
        assistantTurn,
      ]
      state = response.updatedState
      currentBasicInfo = response.updatedBasicInfo
    }

    expect(state.facts.childEnglishLevel?.value).toBe("beginner")
    expect(state.facts.desiredOutcomes?.value).toEqual(expect.arrayContaining(["confidence_and_adaptation"]))
    expect(state.facts.initialAdaptationSupportNeed?.value).toBe(true)
    expect(state.facts.socialPreference?.value).toEqual(["people_and_peer_interaction"])
    expect(state.facts.preferredActivities?.value).toEqual(expect.arrayContaining(["robotics", "science"]))
    expect(state.facts.parentEnglishCommunication?.value).toBe("possible")
    expect(state.facts.parentStayGoals?.value).toEqual(expect.arrayContaining(["cafeDining", "remoteWork", "restWellness"]))
    expect(state.facts.durationWeeks?.value).toBe(2)
    expect(currentBasicInfo.budgetMaxKrw).toBe(9_000_000)
    expect(state.facts.budgetIncludesFlight?.value).toBe(true)
    expect(state.facts.destinationPreference?.value).toEqual(["Singapore", "Auckland"])
    expect(state.facts.preferredRegions?.value).toEqual(expect.arrayContaining(["southeast_asia", "oceania"]))
    expect(state.askedQuestionKeys.filter((key) => key === "child_english_level")).toHaveLength(1)
  })

  it("stores only a special-care follow-up flag when detailed health information is volunteered", async () => {
    const start = startConversation(basicInfo)
    const careQuestionKey = "special_care_follow_up"
    const careState = {
      ...start.updatedState,
      currentQuestionKey: careQuestionKey,
      askedQuestionKeys: [...start.updatedState.askedQuestionKeys, careQuestionKey],
    }
    const response = await processConversationMessage({
      transcript: [],
      currentState: careState,
      basicInfo,
      userMessage: "특별히 신경 써야 할 부분은 있지만 자세한 의료정보는 나중에 기관과 직접 확인할게요.",
      quickReplyKey: null,
      provider: fallbackProvider,
    })
    expect(response.updatedState.facts.specialCareFollowUp?.value).toBe("required")
    expect(response.updatedState.facts.specialCareFollowUp?.evidence).not.toContain("의료정보")
    expect(response.updatedState.facts.specialCareFollowUp?.evidence).not.toContain("질환")
    expect(response.assistantMessage).not.toContain("의료정보")
  })
})
