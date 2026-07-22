import { describe, expect, it } from "vitest"
import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import { calculateProgress, isReadyForRecommendation } from "@/lib/campfit/v3/progress"
import { campfitV3QuestionBank, selectNextQuestion } from "@/lib/campfit/v3/questionBank"
import { CampfitV3BasicInfoSchema } from "@/lib/campfit/v3/schemas"
import { applyQuickReply, createFact, createInitialConversationState, extractDeterministicFacts, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3LLMProvider } from "@/lib/campfit/v3/provider"
import type { CampfitV3BasicInfo, CampfitV3ConversationState, CampfitV3FactKey } from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "다음 여름방학",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 8_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const nullProvider: CampfitV3LLMProvider = {
  analyzeConversation: async () => null,
  generateConsultingResponse: async () => null,
  explainRecommendation: async () => null,
}

describe("CampFit v3 state and question engine", () => {
  it("opens with conversation-first guidance instead of a slot-style prompt", () => {
    const firstQuestion = campfitV3QuestionBank[0]
    expect(firstQuestion?.title).toContain("아이의 영어 경험과 좋아하는 활동")
    expect(firstQuestion?.title).toContain("부모가 현지에서 어떻게 지내고 싶은지")
    expect(firstQuestion?.title).not.toContain("아이 영어 수준은 어느 정도인지도")
  })

  it("starts with the highest priority unanswered question", () => {
    const response = startConversation(basicInfo)
    expect(response.questionKey).toBe("child_english_level")
    expect(response.progress).toBe(35)
  })

  it("separates child and parent English facts", () => {
    const facts = extractDeterministicFacts("아이 영어는 초급이지만 저는 영어로 소통할 수 있어요.")
    expect(facts.find((fact) => fact.key === "childEnglishLevel")?.value).toBe("beginner")
    expect(facts.find((fact) => fact.key === "parentEnglishCommunication")?.value).toBe("possible")
    expect(facts.find((fact) => fact.key === "koreanSupportNeed")).toBeUndefined()
  })

  it("recognizes English levels described separately for multiple children", () => {
    const facts = extractDeterministicFacts("첫째는 영어 수업 참여와 대화가 가능하고 둘째는 단어나 짧은 표현 정도예요.")
    expect(facts.find((fact) => fact.key === "childEnglishLevel")?.value).toBe("beginner")
  })

  it("recognizes simple listening and speaking as basic child English", () => {
    const facts = extractDeterministicFacts("아이에게는 간단한 영어 문장으로 이야기하고 듣는 게 가능해요.")
    expect(facts.find((fact) => fact.key === "childEnglishLevel")?.value).toBe("basic")
  })

  it("recognizes being able to participate in English class as intermediate", () => {
    const facts = extractDeterministicFacts("아이의 영어실력은 영어수업에 참여할 정도의 수준은 돼요.")
    expect(facts.find((fact) => fact.key === "childEnglishLevel")?.value).toBe("intermediate")
  })

  it.each([
    ["5주 정도 생각하고 있어요.", 5],
    ["12주까지도 가능해요.", 12],
  ])("extracts an in-range duration from natural language: %s", (message, expected) => {
    expect(extractDeterministicFacts(message).find((fact) => fact.key === "durationWeeks")?.value).toBe(expected)
  })

  it.each(["13주 정도 머물고 싶어요.", "52주 정도 머물고 싶어요.", "반년 정도 머물고 싶어요."]) (
    "does not confirm an out-of-range duration from %s",
    (message) => {
      expect(extractDeterministicFacts(message).find((fact) => fact.key === "durationWeeks")).toBeUndefined()
    },
  )

  it.each([1, 4, 5, 12])("accepts %s weeks in the API basic-info schema", (weeks) => {
    expect(CampfitV3BasicInfoSchema.safeParse({ ...basicInfo, durationWeeks: weeks }).success).toBe(true)
  })

  it.each([13, 52])("rejects %s weeks in the API basic-info schema", (weeks) => {
    expect(CampfitV3BasicInfoSchema.safeParse({ ...basicInfo, durationWeeks: weeks }).success).toBe(false)
  })

  it("keeps emergency Korean support distinct from daily support", () => {
    const facts = extractDeterministicFacts("평소에는 한국어 지원이 필요 없지만 아이가 아플 때는 있었으면 좋겠어요.")
    expect(facts.find((fact) => fact.key === "koreanSupportNeed")?.value).toBe("emergency_only")
  })

  it("captures English growth and study-only avoidance together", () => {
    const facts = extractDeterministicFacts("영어 실력도 늘었으면 좋겠지만 공부만 하는 캠프는 싫어요.")
    const goals = facts.find((fact) => fact.key === "experienceGoals")?.value as Record<string, string>
    expect(goals["englishIntensive"]).toBe("primary")
    expect(facts.find((fact) => fact.key === "studyOnlyAvoidance")?.value).toBe(true)
  })

  it("captures parent rest and cafe goals without creating child facts", () => {
    const facts = extractDeterministicFacts("아이 캠프 시간에는 저는 카페에 가거나 쉬고 싶어요.")
    expect(facts.find((fact) => fact.key === "parentStayGoals")?.value).toEqual(["restWellness", "cafeDining"])
    expect(facts.find((fact) => fact.subject === "child")).toBeUndefined()
  })

  it("does not turn a child culture goal into a parent stay goal", () => {
    const facts = extractDeterministicFacts("문화·활동과 즐거운 경험이 중요해요.")
    expect(facts.find((fact) => fact.key === "experienceGoals")).toBeDefined()
    expect(facts.find((fact) => fact.key === "parentStayGoals")).toBeUndefined()
  })

  it("retains an explicit false value", () => {
    const state = mergeFacts(createInitialConversationState(), [createFact({ key: "isFirstOverseasEducationExperience", subject: "child", value: false, source: "explicit_user_statement", evidence: "비슷한 경험이 있어요" })])
    expect(state.facts.isFirstOverseasEducationExperience?.value).toBe(false)
  })

  it("does not let inference overwrite an explicit statement", () => {
    const explicit = createFact({ key: "childEnglishLevel", subject: "child", value: "intermediate", source: "explicit_user_statement", evidence: "간단한 대화 가능" })
    const inferred = createFact({ key: "childEnglishLevel", subject: "child", value: "beginner", source: "ai_inference", evidence: "첫 경험", confidence: 0.8 })
    const state = mergeFacts(mergeFacts(createInitialConversationState(), [explicit]), [inferred])
    expect(state.facts.childEnglishLevel?.value).toBe("intermediate")
  })

  it("lets a quick reply override a lower-priority explicit value", () => {
    const explicit = createFact({ key: "koreanSupportNeed", subject: "constraint", value: "preferred", source: "explicit_user_statement", evidence: "있으면 좋음" })
    const state = applyQuickReply(mergeFacts(createInitialConversationState(), [explicit]), "korean_support_need", "none", "중요하지 않아요")
    expect(state.facts.koreanSupportNeed?.value).toBe("none")
  })

  it("lets a user correction override structured input", () => {
    const structured = createFact({ key: "regionImportance", subject: "preference", value: "must", source: "structured_input", evidence: "초기 입력" })
    const correction = createFact({ key: "regionImportance", subject: "preference", value: "soft", source: "user_correction", evidence: "다른 지역도 괜찮음" })
    const state = mergeFacts(mergeFacts(createInitialConversationState(), [structured]), [correction])
    expect(state.facts.regionImportance?.value).toBe("soft")
  })

  it("does not store detailed special-care text in quick-reply evidence", () => {
    const state = applyQuickReply(createInitialConversationState(), "special_care_follow_up", "required", "있어요. 상담할 때 별도로 확인할게요")
    expect(state.facts.specialCareFollowUp?.value).toBe("required")
    expect(state.facts.specialCareFollowUp?.evidence).toBe("특별관리 후속 확인 여부를 선택함")
  })

  it("marks no regional preference and importance together", () => {
    const state = applyQuickReply(createInitialConversationState(), "preferred_region", "no_preference", "지역은 상관없어요")
    expect(state.facts.preferredRegions?.value).toEqual([])
    expect(state.facts.regionImportance?.value).toBe("no_preference")
  })

  it("asks regional importance only after a concrete region", () => {
    const base = completeExcept(["preferredRegions", "regionImportance"])
    expect(selectNextQuestion(base)?.key).toBe("preferred_region")
    const region = applyQuickReply(base, "preferred_region", "oceania", "오세아니아")
    expect(selectNextQuestion(region)?.key).toBe("region_importance")
  })

  it("asks separation readiness only for a first experience", () => {
    const first = mergeFacts(completeExcept(["dayProgramSeparationReadiness"]), [createFact({ key: "isFirstOverseasEducationExperience", subject: "child", value: true, source: "quick_reply", evidence: "첫 경험" })])
    expect(selectNextQuestion(first)?.key).toBe("day_program_separation")
    const experienced = mergeFacts(completeExcept(["dayProgramSeparationReadiness"]), [createFact({ key: "isFirstOverseasEducationExperience", subject: "child", value: false, source: "quick_reply", evidence: "경험 있음" })])
    expect(selectNextQuestion(experienced)).toBeNull()
  })

  it("does not ask a completed question again", () => {
    const state = applyQuickReply(createInitialConversationState(), "child_english_level", "basic", "단어 정도")
    expect(selectNextQuestion({ ...state, askedQuestionKeys: ["child_english_level"], questionCount: 1 })?.key).not.toBe("child_english_level")
  })

  it("stops selecting questions at the maximum of ten", () => {
    const state = { ...createInitialConversationState(), questionCount: 10 }
    expect(selectNextQuestion(state)).toBeNull()
  })

  it("gives full progress credit to a complete explicit state", () => {
    const state = completeExcept([])
    expect(calculateProgress(basicInfo, state)).toBe(100)
    expect(isReadyForRecommendation(state)).toBe(true)
  })

  it("allows a first recommendation before refinement-only facts are answered", () => {
    const state = completeExcept([
      "regionImportance",
      "koreanSupportNeed",
      "parentCommunicationNeed",
      "isFirstOverseasEducationExperience",
      "dayProgramSeparationReadiness",
    ])
    expect(isReadyForRecommendation(state)).toBe(true)
  })

  it("still blocks recommendations when a core fact is missing", () => {
    expect(isReadyForRecommendation(completeExcept(["experienceGoals"]))).toBe(false)
  })

  it("gives at most half slot credit to a high-confidence inference", () => {
    const state = mergeFacts(createInitialConversationState(), [createFact({ key: "experienceGoals", subject: "preference", value: goals("cultureActivity"), source: "ai_inference", confidence: 0.9, evidence: "활동을 원한다고 해석" })])
    expect(calculateProgress(basicInfo, state)).toBe(43)
    expect(isReadyForRecommendation(state)).toBe(false)
  })

  it("gives no progress credit to a conflicted slot", () => {
    const fact = createFact({ key: "childEnglishLevel", subject: "child", value: "basic", source: "quick_reply", evidence: "단어 정도" })
    const state = { ...mergeFacts(createInitialConversationState(), [fact]), conflicts: [{ key: "childEnglishLevel" as const, reason: "답변 충돌" }] }
    expect(calculateProgress(basicInfo, state)).toBe(35)
  })

  it("continues deterministically when the model provider returns null", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({ transcript: [], currentState: start.updatedState, basicInfo, userMessage: "아이 영어는 초급이에요", quickReplyKey: null, provider: nullProvider })
    expect(response.aiUsed).toBe(false)
    expect(response.questionKey).toBe("korean_support_need")
    expect(response.updatedState.facts.childEnglishLevel?.value).toBe("beginner")
    expect(response.warnings).toContain("말씀해주신 내용을 기준으로 상담을 이어갈게요.")
    expect(response.warnings.join(" ")).not.toContain("같은 질문")
  })

  it("does not spend a model call for an allowlisted quick reply", async () => {
    let calls = 0
    const provider: CampfitV3LLMProvider = {
      analyzeConversation: async () => { calls += 1; return null },
      generateConsultingResponse: async () => null,
      explainRecommendation: async () => null,
    }
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({ transcript: [], currentState: start.updatedState, basicInfo, userMessage: "단어·짧은 표현 정도예요", quickReplyKey: "basic", provider })
    expect(calls).toBe(0)
    expect(response.diagnostics).toEqual({
      providerCallAttempted: false,
      providerResponseReceived: false,
      providerResponseValidated: false,
      aiUsed: false,
      fallbackReason: null,
      providerHttpStatus: null,
      providerErrorStatus: null,
      providerRequestCount: 0,
      elapsedMs: 0,
    })
  })

  it("reports a fully validated provider response without weakening deterministic facts", async () => {
    const provider: CampfitV3LLMProvider = {
      analyzeConversation: async () => ({
        assistantMessage: "아이와 부모님의 영어 수준을 분리해 확인했어요.",
        facts: [],
        unresolved: [],
        conflicts: [],
        suggestedNextQuestionKey: "special_care_follow_up",
        nextAction: "ask",
        readyForRecommendation: false,
      }),
      generateConsultingResponse: async () => null,
      explainRecommendation: async () => null,
      getLastDiagnostic: () => ({
        code: "ok",
        providerResponseReceived: true,
        httpStatus: 200,
        errorStatus: null,
        repaired: false,
        requestCount: 1,
        elapsedMs: 1_234,
      }),
    }
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "아이는 영어가 초급이지만 저는 영어로 소통할 수 있어요.",
      quickReplyKey: null,
      provider,
    })

    expect(response.updatedState.facts.childEnglishLevel?.value).toBe("beginner")
    expect(response.updatedState.facts.parentEnglishCommunication?.value).toBe("possible")
    expect(response.updatedState.facts.koreanSupportNeed).toBeUndefined()
    expect(response.diagnostics).toEqual({
      providerCallAttempted: true,
      providerResponseReceived: true,
      providerResponseValidated: true,
      aiUsed: true,
      fallbackReason: null,
      providerHttpStatus: 200,
      providerErrorStatus: null,
      providerRequestCount: 1,
      elapsedMs: 1_234,
    })
  })

  it("preserves deterministic fallback while exposing a timeout classification", async () => {
    const provider: CampfitV3LLMProvider = {
      analyzeConversation: async () => null,
      generateConsultingResponse: async () => null,
      explainRecommendation: async () => null,
      getLastDiagnostic: () => ({
        code: "timeout",
        providerResponseReceived: false,
        httpStatus: null,
        errorStatus: null,
        repaired: false,
        requestCount: 1,
        elapsedMs: 25_001,
      }),
    }
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "아이 영어는 초급이에요",
      quickReplyKey: null,
      provider,
    })

    expect(response.updatedState.facts.childEnglishLevel?.value).toBe("beginner")
    expect(response.aiUsed).toBe(false)
    expect(response.diagnostics).toMatchObject({
      providerCallAttempted: true,
      providerResponseReceived: false,
      providerResponseValidated: false,
      aiUsed: false,
      fallbackReason: "timeout",
      providerHttpStatus: null,
      providerErrorStatus: null,
      providerRequestCount: 1,
      elapsedMs: 25_001,
    })
  })

  it("re-asks the current question without moving progress when free text cannot update its slot", async () => {
    const start = startConversation(basicInfo)
    const response = await processConversationMessage({ transcript: [], currentState: start.updatedState, basicInfo, userMessage: "아직 생각 중이에요", quickReplyKey: null, provider: nullProvider })
    expect(response.questionKey).toBe("child_english_level")
    expect(response.updatedState.failedQuestionKeys).toContain("child_english_level")
    expect(response.updatedState.completedQuestionKeys).not.toContain("child_english_level")
    expect(response.progress).toBe(start.progress)
    expect(response.readyForRecommendation).toBe(false)
    expect(response.diagnostics?.fallbackReason).toBe("provider_unavailable")
  })

  it("lets a quick reply recover a question that previously failed free-text validation", async () => {
    const start = startConversation(basicInfo)
    const failed = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo,
      userMessage: "아직 생각 중이에요",
      quickReplyKey: null,
      provider: nullProvider,
    })

    const recovered = await processConversationMessage({
      transcript: [],
      currentState: failed.updatedState,
      basicInfo,
      userMessage: "영어가 거의 낯설어요",
      quickReplyKey: "beginner",
      provider: nullProvider,
    })

    expect(recovered.updatedState.facts.childEnglishLevel?.value).toBe("beginner")
    expect(recovered.updatedState.completedQuestionKeys).toContain("child_english_level")
    expect(recovered.updatedState.failedQuestionKeys).not.toContain("child_english_level")
    expect(recovered.questionKey).toBe("korean_support_need")
  })

  it("applies conversational budget corrections to the returned basic info", async () => {
    const start = startConversation({ ...basicInfo, budgetMaxKrw: 7_000_000 })
    const response = await processConversationMessage({
      transcript: [],
      currentState: start.updatedState,
      basicInfo: { ...basicInfo, budgetMaxKrw: 7_000_000 },
      userMessage: "예산은 700만 원이 아니라 900만 원까지 가능해요.",
      quickReplyKey: null,
      provider: nullProvider,
    })
    expect(response.updatedBasicInfo.budgetMinKrw).toBe(5_000_000)
    expect(response.updatedBasicInfo.budgetMaxKrw).toBe(9_000_000)
    expect(response.updatedState.facts.budgetRangeKrw?.source).toBe("user_correction")
  })

  it("extracts a strong Oceania preference while allowing alternatives", () => {
    const facts = extractDeterministicFacts("호주가 가장 좋지만 가족 전체 예산은 700만 원 정도라 다른 지역도 괜찮아요.", basicInfo)
    expect(facts.find((fact) => fact.key === "preferredRegions")?.value).toEqual(["oceania"])
    expect(facts.find((fact) => fact.key === "regionImportance")?.value).toBe("strong")
  })

  it("treats an explicit lack of a destination as no regional preference", () => {
    const facts = extractDeterministicFacts("딱히 정해둔 도시는 없는데 안전이나 의료를 중요하게 생각해요.", basicInfo)
    expect(facts.find((fact) => fact.key === "preferredRegions")?.value).toEqual([])
    expect(facts.find((fact) => fact.key === "regionImportance")?.value).toBe("no_preference")
  })

  it("understands a no-region answer even when it starts with 상관없긴한데", () => {
    const facts = extractDeterministicFacts("상관없긴한데 가능하면 의료 선진국이 좋을 것 같아요. 그리고 치안도 중요해요.", basicInfo)
    expect(facts.find((fact) => fact.key === "preferredRegions")?.value).toEqual([])
    expect(facts.find((fact) => fact.key === "regionImportance")?.value).toBe("no_preference")
    expect(facts.find((fact) => fact.key === "worries")?.value).toEqual(expect.arrayContaining(["medical_access", "city_safety"]))
  })

  it("keeps a region mentioned as too far out of the recommendation pool", () => {
    const facts = extractDeterministicFacts("비행시간이 너무 길지 않았으면 좋겠어요. 유럽은 너무 멀어요.", basicInfo)
    expect(facts.find((fact) => fact.key === "excludedRegions")?.value).toEqual(["europe"])
    expect(facts.find((fact) => fact.key === "preferredRegions")?.value).toEqual([])
    expect(facts.find((fact) => fact.key === "regionImportance")?.value).toBe("no_preference")
  })

  it("extracts program commute and meal constraints from natural language", () => {
    const facts = extractDeterministicFacts("아이가 숙소에서 대중교통으로 캠프에 가는 게 힘들지 않았으면 좋겠고, 점심 도시락은 꼭 필요해요.", basicInfo)
    expect(facts.find((fact) => fact.key === "programCommuteNeed")?.value).toBe("simple_only")
    expect(facts.find((fact) => fact.key === "programMealNeed")?.value).toBe("lunch_required")
  })

  it("lets later natural language correct a quick-reply fact", async () => {
    let state = applyQuickReply(createInitialConversationState(), "child_english_level", "beginner", "영어가 거의 낯설어요")
    state = {
      ...state,
      askedQuestionKeys: ["child_english_level", "parent_communication_need"],
      completedQuestionKeys: ["child_english_level"],
      currentQuestionKey: "parent_communication_need",
      questionCount: 2,
      progress: 42,
    }
    const response = await processConversationMessage({ transcript: [], currentState: state, basicInfo, userMessage: "아니라 아이 영어는 중급이에요.", quickReplyKey: null, provider: nullProvider })
    expect(response.updatedState.facts.childEnglishLevel?.value).toBe("intermediate")
    expect(response.updatedState.facts.childEnglishLevel?.source).toBe("user_correction")
  })

  it("canonicalizes special-care free text before sending it to the provider", async () => {
    let seenMessage = ""
    let seenTranscript = ""
    const provider: CampfitV3LLMProvider = {
      analyzeConversation: async (input) => {
        seenMessage = input.userMessage
        seenTranscript = input.transcript.at(-1)?.content ?? ""
        return null
      },
      generateConsultingResponse: async () => null,
      explainRecommendation: async () => null,
    }
    const state = {
      ...createInitialConversationState(),
      askedQuestionKeys: ["special_care_follow_up"],
      currentQuestionKey: "special_care_follow_up",
      questionCount: 1,
      progress: 35,
    }
    const raw = "특정 약을 매일 복용해서 별도 확인이 필요해요"
    const response = await processConversationMessage({ transcript: [{ role: "user", content: raw, questionKey: "special_care_follow_up" }], currentState: state, basicInfo, userMessage: raw, quickReplyKey: null, provider })
    expect(seenMessage).toBe("있어요. 상담할 때 별도로 확인할게요")
    expect(seenTranscript).toBe("있어요. 상담할 때 별도로 확인할게요")
    expect(response.updatedState.facts.specialCareFollowUp?.value).toBe("required")
    expect(response.updatedState.facts.specialCareFollowUp?.evidence).not.toContain("약")
  })

  it("redacts volunteered health details outside the special-care question", async () => {
    const seen: string[] = []
    const provider: CampfitV3LLMProvider = {
      analyzeConversation: async (input) => {
        seen.push(input.userMessage, ...input.transcript.map((item) => item.content))
        return null
      },
      generateConsultingResponse: async () => null,
      explainRecommendation: async () => null,
    }
    const start = startConversation(basicInfo)
    const raw = "아이가 천식 진단을 받아 특정 약을 매일 복용해요"
    const response = await processConversationMessage({
      transcript: [{ role: "user", content: raw }],
      currentState: start.updatedState,
      basicInfo,
      userMessage: raw,
      quickReplyKey: null,
      provider,
    })
    expect(seen).toEqual([
      "있어요. 상담할 때 별도로 확인할게요",
      "있어요. 상담할 때 별도로 확인할게요",
    ])
    expect(response.questionKey).toBe("child_english_level")
    expect(response.updatedState.facts.specialCareFollowUp?.value).toBe("required")
    expect(Object.values(response.updatedState.facts).every((fact) => fact === undefined || !fact.evidence.includes("천식"))).toBe(true)
  })

  it("does not redact ordinary Korean-support wording containing 약간", async () => {
    let seenMessage = ""
    const provider: CampfitV3LLMProvider = {
      analyzeConversation: async (input) => { seenMessage = input.userMessage; return null },
      generateConsultingResponse: async () => null,
      explainRecommendation: async () => null,
    }
    const start = startConversation(basicInfo)
    const message = "한국어 지원이 약간 있으면 좋겠어요"
    await processConversationMessage({ transcript: [], currentState: start.updatedState, basicInfo, userMessage: message, quickReplyKey: null, provider })
    expect(seenMessage).toBe(message)
  })

  it("does not misclassify special-care negation or compound support as none", () => {
    const negated = extractDeterministicFacts("알레르기가 없는 것은 아니에요", basicInfo, "special_care_follow_up")
    const compound = extractDeterministicFacts("건강 문제는 없지만 복약 확인은 필요해요", basicInfo, "special_care_follow_up")
    expect(negated.find((fact) => fact.key === "specialCareFollowUp")?.value).toBe("required")
    expect(compound.find((fact) => fact.key === "specialCareFollowUp")?.value).toBe("required")
  })

  it("never exceeds ten recorded questions in fallback mode", async () => {
    const state: CampfitV3ConversationState = { ...createInitialConversationState(), currentQuestionKey: "child_english_level", askedQuestionKeys: Array.from({ length: 10 }, (_, index) => `asked-${index}`), questionCount: 10 }
    const response = await processConversationMessage({ transcript: [], currentState: state, basicInfo, userMessage: "초급이에요", quickReplyKey: "beginner", provider: nullProvider })
    expect(response.updatedState.questionCount).toBe(10)
    expect(response.questionKey).toBeNull()
    expect(response.warnings).toHaveLength(1)
  })
})

function completeExcept(excluded: readonly CampfitV3FactKey[]): CampfitV3ConversationState {
  const values: Partial<Record<CampfitV3FactKey, unknown>> = {
    childEnglishLevel: "basic",
    experienceGoals: goals("cultureActivity"),
    preferredRegions: [],
    regionImportance: "no_preference",
    koreanSupportNeed: "emergency_only",
    parentCommunicationNeed: "issue_only",
    parentStayGoals: ["restWellness"],
    specialCareFollowUp: "none",
    isFirstOverseasEducationExperience: false,
  }
  return mergeFacts(createInitialConversationState(), Object.entries(values).flatMap(([key, value]) => excluded.includes(key as CampfitV3FactKey) ? [] : [createFact({ key: key as CampfitV3FactKey, subject: "preference", value, source: "quick_reply", evidence: "테스트" })]))
}

function goals(primary: "schoolSchooling" | "englishIntensive" | "subjectProject" | "cultureActivity") {
  return {
    schoolSchooling: primary === "schoolSchooling" ? "primary" : "none",
    englishIntensive: primary === "englishIntensive" ? "primary" : "none",
    subjectProject: primary === "subjectProject" ? "primary" : "none",
    cultureActivity: primary === "cultureActivity" ? "primary" : "none",
  }
}
