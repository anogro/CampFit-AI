import { describe, expect, it } from "vitest"
import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import { extractDeterministicFacts } from "@/lib/campfit/v3/stateEngine"
import { parseStructuredProviderText } from "@/lib/campfit/v3/providerNormalization"
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

const noProvider: CampfitV3LLMProvider = {
  analyzeConversation: async () => null,
  generateConsultingResponse: async () => null,
  explainRecommendation: async () => null,
}

function needsFact(value: unknown) {
  return {
    key: "parentExperienceNeeds" as const,
    subject: "preference" as const,
    value,
    source: "explicit_user_statement" as const,
    confidence: 1,
    evidence: "부모가 아이에게 기대하는 경험을 설명함",
  }
}

function fullNeeds(overrides: Record<string, unknown> = {}) {
  return {
    english_growth: { importance: "unspecified", evidence: [] },
    peer_interaction: { importance: "unspecified", evidence: [] },
    global_experience: { importance: "unspecified", evidence: [] },
    independence_confidence: { importance: "unspecified", evidence: [] },
    school_learning_experience: { importance: "unspecified", evidence: [] },
    ...overrides,
  }
}

describe("parent experience needs", () => {
  it.each([
    ["영어도 늘면 좋겠지만 제일 중요한 건 외국 친구들이랑 어울려보는 거예요.", "nice_to_have", "primary", "peer_interaction"],
    ["내년에 해외로 이사할 수도 있어서 국제학교를 미리 경험해보고 싶어요.", "unspecified", "primary", "school_learning_experience"],
    ["영어 공부를 빡세게 시키려는 건 아니고, 영어를 자연스럽게 쓰면서 친구들이랑 재미있게 지냈으면 좋겠어요.", "important", "important", "peer_interaction"],
    ["한국에서 하기 어려운 새로운 경험을 많이 해봤으면 좋겠어요.", "unspecified", "important", "global_experience"],
    ["새로운 곳에서도 혼자 해낼 수 있다는 자신감이 생겼으면 좋겠어요.", "unspecified", "primary", "independence_confidence"],
    ["영어도 하고 친구도 사귀면 좋지만 무엇보다 아이가 새로운 문화를 경험했으면 좋겠어요.", "nice_to_have", "primary", "global_experience"],
    ["국제학교는 굳이 안 가도 돼요. 현지 아이들과 어울리고 다양한 활동을 하는 게 더 중요해요.", "unspecified", "primary", "peer_interaction"],
    ["아이가 낯을 많이 가려서 이번에는 혼자서도 해볼 수 있다는 자신감을 얻었으면 좋겠어요.", "unspecified", "primary", "independence_confidence"],
  ] as const)("extracts %s without collapsing relative priorities", (message, englishImportance, secondImportance, axis) => {
    const value = extractDeterministicFacts(message).find((fact) => fact.key === "parentExperienceNeeds")?.value as Record<string, { importance: string }> | undefined
    expect(value).toBeDefined()
    if (englishImportance !== "unspecified") expect(value?.["english_growth"]?.importance).toBe(englishImportance)
    expect(value?.[axis]?.importance).toBe(secondImportance)
    if (message.startsWith("국제학교는")) expect(value?.["school_learning_experience"]?.importance).toBe("avoid")
  })

  it("separates a current child trait from the desired independence goal", () => {
    const facts = extractDeterministicFacts("아이가 낯을 많이 가려서 이번에는 혼자서도 해볼 수 있다는 자신감을 얻었으면 좋겠어요.")
    const value = facts.find((fact) => fact.key === "parentExperienceNeeds")?.value as Record<string, { importance: string }> | undefined
    expect(value?.["independence_confidence"]?.importance).toBe("primary")
    expect(facts.find((fact) => fact.key === "dayProgramSeparationReadiness")).toBeUndefined()
  })

  it("keeps English secondary when the parent states peer interaction first", () => {
    const facts = extractDeterministicFacts("외국 친구들과 어울리는 게 가장 중요하고 영어는 늘면 좋겠어요.")
    const value = facts.find((fact) => fact.key === "parentExperienceNeeds")?.value as Record<string, { importance: string }> | undefined
    expect(value?.["peer_interaction"]?.importance).toBe("primary")
    expect(value?.["english_growth"]?.importance).toBe("nice_to_have")
  })

  it("treats a clear English-versus-peer contrast as a peer-first goal", () => {
    const facts = extractDeterministicFacts("영어도 늘었으면 좋겠지만 외국 친구들이랑 많이 어울렸으면 좋겠어요.")
    const value = facts.find((fact) => fact.key === "parentExperienceNeeds")?.value as Record<string, { importance: string }> | undefined
    expect(value?.["peer_interaction"]?.importance).toBe("primary")
    expect(value?.["english_growth"]?.importance).toBe("nice_to_have")
  })

  it("recognizes school learning as primary in a natural school-life sentence", () => {
    const facts = extractDeterministicFacts("해외 학교생활과 수업 방식을 경험하는 게 가장 중요해요. 아이는 만들기와 과학실험을 아주 좋아하고, 영어 설명은 이해하고 질문에 영어로 대답할 수 있어요. 오세아니아가 좋아요.")
    const value = facts.find((fact) => fact.key === "parentExperienceNeeds")?.value as Record<string, { importance: string }> | undefined
    expect(value?.["school_learning_experience"]?.importance).toBe("primary")
    const goals = facts.find((fact) => fact.key === "experienceGoals")?.value as Record<string, string> | undefined
    expect(goals?.["schoolSchooling"]).toBe("primary")
  })

  it("accepts a semantically generalized Solar-shaped fact when evidence is grounded", () => {
    const payload = {
      assistantMessage: "영어를 실제로 사용하면서 또래와 어울리는 경험을 기대하고 계시군요.",
      facts: [needsFact(fullNeeds({
        english_growth: { importance: "nice_to_have", evidence: ["영어도 늘면 좋겠지만"] },
        peer_interaction: { importance: "primary", evidence: ["제일 중요한 건 외국 친구들이랑 어울려보는 것"] },
      }))],
      unresolved: [],
      conflicts: [],
      suggestedNextQuestionKey: "child_english_level",
      nextAction: "ask",
      readyForRecommendation: false,
    }
    const result = parseStructuredProviderText(JSON.stringify(payload), ["child_english_level"])
    expect(result.model?.facts[0]?.key).toBe("parentExperienceNeeds")
    expect((result.model?.facts[0]?.value as Record<string, { importance: string }>)?.["peer_interaction"]?.importance).toBe("primary")
  })

  it("grounds acknowledgement and skips the product-type goal question after a parent goal is known", async () => {
    const start = startConversation(basicInfo)
    const provider: CampfitV3LLMProvider = {
      ...noProvider,
      analyzeConversation: async () => ({
        assistantMessage: "국제학교 경험을 원하시는군요.",
        facts: [needsFact(fullNeeds({
          school_learning_experience: { importance: "primary", evidence: ["국제학교를 미리 경험해보고 싶어요"] },
        }))],
        unresolved: [],
        conflicts: [],
        suggestedNextQuestionKey: "primary_experience_goal",
        nextAction: "ask",
        readyForRecommendation: false,
      }),
    }
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "내년에 해외로 이사할 수도 있어서 국제학교를 미리 경험해보고 싶어요.",
      quickReplyKey: null,
      provider,
    })
    expect(response.updatedState.facts.parentExperienceNeeds?.value).toMatchObject({ school_learning_experience: { importance: "primary" } })
    expect(response.assistantMessage).toContain("해외 학교생활과 수업 방식을 미리 경험하는 것")
    expect(response.questionKey).not.toBe("primary_experience_goal")
    expect(response.acknowledgementEvidence?.[0]?.factKey).toBe("parentExperienceNeeds")
  })

  it("uses the same grounded synthesis when the provider is unavailable", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "영어도 늘면 좋겠지만 제일 중요한 건 외국 친구들이랑 어울려보는 거예요.",
      quickReplyKey: null,
      provider: noProvider,
    })
    expect(response.aiUsed).toBe(false)
    expect(response.updatedState.facts.parentExperienceNeeds?.value).toMatchObject({
      english_growth: { importance: "nice_to_have" },
      peer_interaction: { importance: "primary" },
    })
    expect(response.assistantMessage).toContain("또래와 어울리는 것을 가장 중요")
    expect(response.assistantMessage).not.toContain("있으면 좋은 경험")
    expect(response.assistantMessage).not.toContain("nice_to_have")
    expect(response.questionKey).not.toBe("primary_experience_goal")
  })

  it("keeps a grounded explicit peer priority when the provider reverses the priorities", async () => {
    const start = startConversation(basicInfo)
    const provider: CampfitV3LLMProvider = {
      ...noProvider,
      analyzeConversation: async () => ({
        assistantMessage: "영어 성장을 가장 중요하게 보시는군요.",
        facts: [needsFact(fullNeeds({
          english_growth: { importance: "primary", evidence: ["영어는 늘면 좋겠어요"] },
          peer_interaction: { importance: "nice_to_have", evidence: ["외국 친구들과 어울리는 게 좋겠어요"] },
        }))],
        unresolved: [],
        conflicts: [],
        suggestedNextQuestionKey: "child_english_level",
        nextAction: "ask",
        readyForRecommendation: false,
      }),
    }
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "외국 친구들과 어울리는 게 가장 중요하고 영어는 늘면 좋겠어요.",
      quickReplyKey: null,
      provider,
    })
    expect(response.updatedState.facts.parentExperienceNeeds?.value).toMatchObject({
      english_growth: { importance: "nice_to_have" },
      peer_interaction: { importance: "primary" },
    })
  })

  it("keeps an explicit school primary when the provider lowers that same priority", async () => {
    const start = startConversation(basicInfo)
    const provider: CampfitV3LLMProvider = {
      ...noProvider,
      analyzeConversation: async () => ({
        assistantMessage: "",
        facts: [needsFact(fullNeeds({
          english_growth: { importance: "primary", evidence: ["영어 설명을 이해해요"] },
          school_learning_experience: { importance: "important", evidence: ["해외 학교생활을 경험하고 싶어요"] },
        }))],
        unresolved: [],
        conflicts: [],
        suggestedNextQuestionKey: "child_english_level",
        nextAction: "ask",
        readyForRecommendation: false,
      }),
    }
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "해외 학교생활과 수업 방식을 경험하는 게 가장 중요해요. 영어 설명은 이해하고 질문에 영어로 대답할 수 있어요.",
      quickReplyKey: null,
      provider,
    })
    expect(response.updatedState.facts.parentExperienceNeeds?.value).toMatchObject({
      school_learning_experience: { importance: "primary" },
    })
  })

  it("supplements an explicit parent goal when the provider omits it", async () => {
    const start = startConversation(basicInfo)
    const provider: CampfitV3LLMProvider = {
      ...noProvider,
      analyzeConversation: async () => ({
        assistantMessage: "",
        facts: [],
        unresolved: [],
        conflicts: [],
        suggestedNextQuestionKey: "child_english_level",
        nextAction: "ask",
        readyForRecommendation: false,
      }),
    }
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "해외 학교생활과 수업 방식을 경험하는 게 가장 중요해요. 영어 설명은 이해하고 질문에 영어로 대답할 수 있어요.",
      quickReplyKey: null,
      provider,
    })
    expect(response.updatedState.facts.parentExperienceNeeds?.value).toMatchObject({
      school_learning_experience: { importance: "primary" },
    })
  })

  it("rejects an unsupported parent need even when the provider invents it", async () => {
    const start = startConversation(basicInfo)
    const provider: CampfitV3LLMProvider = {
      ...noProvider,
      analyzeConversation: async () => ({
        assistantMessage: "국제학교 수업을 원하시는군요.",
        facts: [needsFact(fullNeeds({
          school_learning_experience: { importance: "primary", evidence: ["국제학교를 원함"] },
        }))],
        unresolved: [],
        conflicts: [],
        suggestedNextQuestionKey: "child_english_level",
        nextAction: "ask",
        readyForRecommendation: false,
      }),
    }
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "영어를 자연스럽게 쓰면서 재미있게 지냈으면 좋겠어요.",
      quickReplyKey: null,
      provider,
    })
    expect(response.updatedState.facts.parentExperienceNeeds).toBeUndefined()
    expect(response.assistantMessage).not.toContain("국제학교")
  })
})
