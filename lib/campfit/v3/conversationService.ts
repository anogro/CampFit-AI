import { allowedQuestionKeys, getQuestion, isQuestionCompleted, selectNextQuestion } from "@/lib/campfit/v3/questionBank"
import { calculateProgress, isReadyForRecommendation, progressMessage } from "@/lib/campfit/v3/progress"
import { englishEvidenceGap } from "@/lib/campfit/v3/englishReadiness"
import { parentExperienceNeedsAcknowledgement, parentNeedEvidenceIsGrounded, hasParentExperienceNeeds, isParentExperienceNeedsValue } from "@/lib/campfit/v3/parentExperienceNeeds"
import { activityPreferenceAcknowledgement, activityPreferenceValueIsGrounded, hasMeaningfulActivityEvidence } from "@/lib/campfit/v3/activityPreferences"
import { participationProfileAcknowledgement, participationProfileValueIsGrounded } from "@/lib/campfit/v3/participationProfile"
import { CAMPFIT_V3_MAX_DURATION_WEEKS, CAMPFIT_V3_MIN_DURATION_WEEKS } from "@/types/campfitV3"
import {
  applyQuickReply,
  canonicalizeSpecialCareMessage,
  containsSensitiveHealthDetail,
  createFact,
  createInitialConversationState,
  extractDeterministicFacts,
  isSemanticallyValidModelFact,
  markChangedExplicitFactsAsCorrections,
  mergeFacts,
  syncEnglishReadiness,
} from "@/lib/campfit/v3/stateEngine"
import type {
  CampfitV3LLMProvider,
  CampfitV3ModelResponse,
  CampfitV3ProviderDiagnostic,
} from "@/lib/campfit/v3/provider"
import type {
  CampfitV3AiDiagnostics,
  CampfitV3AcknowledgementEvidence,
  CampfitV3BasicInfo,
  CampfitV3ConversationResponse,
  CampfitV3ConversationState,
  CampfitV3Fact,
  CampfitV3FactKey,
  CampfitV3FallbackReason,
  CampfitV3TranscriptMessage,
} from "@/types/campfitV3"

export function startConversation(basicInfo: CampfitV3BasicInfo): CampfitV3ConversationResponse {
  const seeded = seedBasicInfoFacts(createInitialConversationState(), basicInfo)
  const question = selectNextQuestion(seeded)
  const asked = question === null ? seeded : markQuestionAsked(seeded, question.key)
  const progress = calculateProgress(basicInfo, asked)
  const state = { ...asked, progress }
  return {
    assistantMessage: question?.title ?? "기본 조건을 확인했어요.",
    updatedState: state,
    updatedBasicInfo: basicInfo,
    quickReplies: question?.quickReplies ?? [],
    questionKey: question?.key ?? null,
    progress,
    progressMessage: progressMessage(progress),
    readyForRecommendation: false,
    conflicts: [],
    warnings: [],
    aiUsed: false,
    diagnostics: noAiDiagnostics(),
  }
}

export async function processConversationMessage(input: {
  readonly transcript: readonly CampfitV3TranscriptMessage[]
  readonly currentState: CampfitV3ConversationState
  readonly basicInfo: CampfitV3BasicInfo
  readonly userMessage: string
  readonly quickReplyKey: string | null
  readonly provider: CampfitV3LLMProvider
}): Promise<CampfitV3ConversationResponse> {
  const currentQuestion = getQuestion(input.currentState.currentQuestionKey)
  let state = input.currentState
  let model: CampfitV3ModelResponse | null = null
  let providerDiagnostic: CampfitV3ProviderDiagnostic | null = null
  let deterministicFacts: readonly CampfitV3Fact[] = []
  let acceptedModelFacts: readonly CampfitV3Fact[] = []
  const warnings: string[] = []
  const sensitiveHealthDetail = containsSensitiveHealthDetail(input.userMessage)
  const specialCareAnswer = currentQuestion?.key === "special_care_follow_up"
    && isSpecialCareAnswer(input.userMessage)
  const safeUserMessage = specialCareAnswer || sensitiveHealthDetail
    ? canonicalizeSpecialCareMessage(input.userMessage)
    : input.userMessage
  const safeTranscript = input.transcript.map((item) => item.role === "user" && (
    (item.questionKey === "special_care_follow_up" && isSpecialCareAnswer(item.content))
    || containsSensitiveHealthDetail(item.content)
    || (currentQuestion?.key === "special_care_follow_up" && item.content === input.userMessage && isSpecialCareAnswer(item.content))
  )
    ? { ...item, content: canonicalizeSpecialCareMessage(item.content) }
    : item)

  if (input.quickReplyKey !== null) {
    const reply = currentQuestion?.quickReplies.find((candidate) => candidate.key === input.quickReplyKey) ?? null
    if (currentQuestion === null || reply === null) {
      state = markQuestionFailed(state, currentQuestion?.key ?? input.currentState.currentQuestionKey)
      warnings.push("선택지를 확인하지 못했어요. 표시된 답변 중에서 다시 선택해 주세요.")
    } else {
      state = applyQuickReply(state, currentQuestion.key, reply.key, reply.label)
    }
  } else {
    const extractedFacts = extractDeterministicFacts(safeUserMessage, input.basicInfo, currentQuestion?.key ?? null)
    const privacySafeFacts = sensitiveHealthDetail && !extractedFacts.some((fact) => fact.key === "specialCareFollowUp")
      ? [...extractedFacts, createFact({
        key: "specialCareFollowUp",
        subject: "constraint",
        value: "required",
        source: "explicit_user_statement",
        evidence: "특별관리 후속 확인이 필요하다고 답함",
      })]
      : extractedFacts
    model = await input.provider.analyzeConversation({
      transcript: safeTranscript,
      currentState: state,
      basicInfo: applyBasicInfoFacts(input.basicInfo, state),
      userMessage: safeUserMessage,
      allowedQuestionKeys: allowedQuestionKeys(state),
    })
    providerDiagnostic = input.provider.getLastDiagnostic?.() ?? null
    if (model !== null) {
      acceptedModelFacts = acceptedFactsFromModel(state, model, safeUserMessage)
      const deterministicParentNeeds = privacySafeFacts.find((fact) => fact.key === "parentExperienceNeeds")
      const modelParentNeeds = acceptedModelFacts.find((fact) => fact.key === "parentExperienceNeeds")
      const preferDeterministicParentNeeds = deterministicParentNeeds !== undefined && modelParentNeeds !== undefined
        && parentNeedPriorityConflict(deterministicParentNeeds.value, modelParentNeeds.value)
      if (preferDeterministicParentNeeds) {
        // Keep a grounded explicit priority when the provider returns a
        // contradictory priority for the same user sentence. This is a
        // narrow normalization guard, not a provider replacement path.
        acceptedModelFacts = acceptedModelFacts.filter((fact) => fact.key !== "parentExperienceNeeds")
      }
      state = mergeModelResponse(state, model, acceptedModelFacts)
      // Solar remains the semantic extractor on the normal path, but grounded
      // deterministic English evidence supplements omitted model fields. A
      // partial provider response must not reopen an English question when the
      // user's wording already contains enough recommendation evidence. A
      // grounded deterministic parent goal also fills an omitted provider
      // field; it does not override a validated provider value for the same
      // fact unless the two explicit priorities conflict.
      const acceptedKeys = new Set(acceptedModelFacts.map((fact) => fact.key))
      const modelMentionedParentNeeds = acceptedModelFacts.some((fact) => fact.key === "parentExperienceNeeds")
      deterministicFacts = privacySafeFacts.filter((fact) => (isGroundedSupplementFactKey(fact.key)
        || fact.key === "parentExperienceNeeds" && (preferDeterministicParentNeeds || !modelMentionedParentNeeds))
        && !acceptedKeys.has(fact.key))
      state = mergeFacts(state, deterministicFacts)
    } else {
      deterministicFacts = privacySafeFacts
      const deterministic = markChangedExplicitFactsAsCorrections(
        state,
        deterministicFacts,
        isCorrectionLanguage(input.userMessage),
      )
      state = mergeFacts(state, deterministic)
    }
  }

  state = syncEnglishReadiness(state)

  const relevantDeterministicFacts = currentQuestion === null
    ? deterministicFacts.length > 0
    : hasQuestionRelevantFacts(currentQuestion.key, deterministicFacts)
  const relevantModelFacts = currentQuestion === null
    ? acceptedModelFacts.length > 0
    : hasQuestionRelevantFacts(currentQuestion.key, acceptedModelFacts)
  const partialUnderstanding = relevantDeterministicFacts || relevantModelFacts
  if (currentQuestion !== null) {
    state = isQuestionCompleted(currentQuestion, state)
      ? markQuestionCompleted(state, currentQuestion.key)
      : partialUnderstanding
        ? keepQuestionPending(state, currentQuestion.key)
        : markQuestionFailed(state, currentQuestion.key)
  }

  const updatedBasicInfo = applyBasicInfoFacts(input.basicInfo, state)
  const ready = isReadyForRecommendation(state)
  const continuingReadySession = input.currentState.currentQuestionKey === null && ready
  const suggestedNextQuestionKey = model?.suggestedNextQuestionKey === "korean_support_need"
    && !mentionsKoreanSupportNeed(input.userMessage)
    ? null
    : model?.suggestedNextQuestionKey ?? null
  const nextQuestion = ready && !continuingReadySession
    ? null
    : selectNextQuestion(state, suggestedNextQuestionKey)
  if (nextQuestion !== null) state = markQuestionAsked(state, nextQuestion.key)
  else state = { ...state, currentQuestionKey: null }

  const calculatedProgress = calculateProgress(updatedBasicInfo, state)
  const progress = ready ? 100 : Math.max(input.currentState.progress, calculatedProgress)
  state = { ...state, progress }

  // A previously persisted optional/confirmation question may still be the
  // current key after the planner policy changes. If the planner selected a
  // different question, render that question instead of repeating the stale
  // confirmation prompt.
  const targetUpdated = currentQuestion === null
    || state.currentQuestionKey !== currentQuestion.key
    || state.completedQuestionKeys.includes(currentQuestion.key)
  const diagnostics = buildDiagnostics(input.quickReplyKey, model, providerDiagnostic, targetUpdated)
  const diagnosticWarning = warningForDiagnostics(diagnostics, targetUpdated, partialUnderstanding)
  if (diagnosticWarning !== null) warnings.push(diagnosticWarning)
  const maxReached = !ready && nextQuestion === null && state.questionCount >= 10
  if (maxReached) warnings.push("최대 질문 수에 도달했지만 필수 조건이 남아 있어 결과를 만들지 않았습니다.")

  const plannedQuestionText = nextQuestion?.key === "child_english_level" && englishEvidenceGap(state) !== null
    ? followUpQuestionText(nextQuestion, input.transcript, state)
    : nextQuestion?.title ?? "확인이 필요한 조건을 다시 살펴보고 있어요."
  const nextQuestionText = currentQuestion === null || targetUpdated
    ? plannedQuestionText
    : followUpQuestionText(currentQuestion, input.transcript, state)
  const groundedAcknowledgement = buildGroundedAcknowledgement(
    [...deterministicFacts, ...acceptedModelFacts],
    input.userMessage,
  )
  const canAcknowledgeGroundedFacts = partialUnderstanding || groundedAcknowledgement.evidence.length > 0
  const assistantMessage = ready
    ? "필요한 내용을 모두 확인했어요. 지금 조건에 맞는 경험 방향과 도시, 프로그램 후보를 정리해볼게요."
      : currentQuestion !== null && !targetUpdated
      ? canAcknowledgeGroundedFacts
        ? `${groundedAcknowledgement.text}\n\n${nextQuestionText}`
        : `아직 답변을 충분히 파악하지 못했어요.\n\n${nextQuestionText}`
      : `${groundedAcknowledgement.text}\n\n${nextQuestionText}`

  return {
    assistantMessage,
    acknowledgementEvidence: groundedAcknowledgement.evidence,
    updatedState: state,
    updatedBasicInfo,
    quickReplies: nextQuestion?.quickReplies ?? [],
    questionKey: nextQuestion?.key ?? null,
    progress,
    progressMessage: progressMessage(progress),
    readyForRecommendation: ready,
    conflicts: state.conflicts,
    warnings,
    aiUsed: model !== null,
    diagnostics,
  }
}

function acceptedFactsFromModel(
  state: CampfitV3ConversationState,
  model: CampfitV3ModelResponse,
  userMessage: string,
): readonly CampfitV3Fact[] {
  return model.facts.flatMap((fact): readonly CampfitV3Fact[] => {
    if (fact.key === "englishReadiness") return []
    if (fact.key === "parentEnglishCommunication" && !mentionsParentEnglishCommunication(userMessage)) return []
    if (fact.key === "koreanSupportNeed" && !mentionsKoreanSupportNeed(userMessage)) return []
    if (isEnglishEvidenceKey(fact.key) && !isEnglishModelFactSupportedByUserText(fact, userMessage)) return []
    if (fact.key === "parentExperienceNeeds" && !parentNeedEvidenceIsGrounded(fact.value, fact.evidence, userMessage)) return []
    if (fact.key === "activityPreferences" && !activityPreferenceValueIsGrounded(fact.value, fact.evidence, userMessage)) return []
    if (fact.key === "participationProfile" && !participationProfileValueIsGrounded(fact.value, fact.evidence, userMessage)) return []
    if (!isSemanticallyValidModelFact(fact)) return []
    const existing = state.facts[fact.key]
    if (existing !== undefined && existing.source !== "ai_inference" && !isCorrectionLanguage(userMessage)) {
      return []
    }
    const evidence = fact.key === "specialCareFollowUp" ? "특별관리 후속 확인 여부를 자연어로 답함" : fact.evidence
    return [createFact({
      key: fact.key,
      subject: fact.subject,
      value: fact.value,
      source: existing !== undefined && fact.source === "explicit_user_statement" ? "user_correction" : fact.source,
      confidence: fact.source === "explicit_user_statement" ? 1 : fact.confidence,
      evidence,
    })]
  })
}

function mergeModelResponse(
  state: CampfitV3ConversationState,
  model: CampfitV3ModelResponse,
  facts: readonly CampfitV3Fact[],
): CampfitV3ConversationState {
  const merged = mergeFacts(state, facts)
  const conflictMap = new Map(merged.conflicts.map((conflict) => [conflict.key, conflict]))
  for (const conflict of model.conflicts) {
    conflictMap.set(conflict.key, {
      key: conflict.key,
      reason: conflict.key === "specialCareFollowUp" ? "특별관리 후속 확인 여부가 명확하지 않음" : conflict.reason,
    })
  }
  const unresolved = Array.from(new Set([
    ...merged.unresolved,
    ...model.unresolved.filter((key) => merged.facts[key] === undefined || merged.facts[key]?.source === "ai_inference"),
  ]))
  return { ...merged, unresolved, conflicts: Array.from(conflictMap.values()) }
}

function seedBasicInfoFacts(state: CampfitV3ConversationState, basicInfo: CampfitV3BasicInfo): CampfitV3ConversationState {
  return mergeFacts(state, [
    createFact({ key: "budgetRangeKrw", subject: "constraint", value: { min: basicInfo.budgetMinKrw, max: basicInfo.budgetMaxKrw }, source: "structured_input", evidence: "기본정보 예산 범위" }),
    createFact({ key: "departureWindow", subject: "constraint", value: basicInfo.departureWindow, source: "structured_input", evidence: "기본정보 출발 시기" }),
    createFact({ key: "durationWeeks", subject: "constraint", value: basicInfo.durationWeeks, source: "structured_input", evidence: "기본정보 체류 기간" }),
  ])
}

function applyBasicInfoFacts(basicInfo: CampfitV3BasicInfo, state: CampfitV3ConversationState): CampfitV3BasicInfo {
  const budget = state.facts.budgetRangeKrw?.value
  const budgetRange = isBudgetRange(budget) ? budget : { min: basicInfo.budgetMinKrw, max: basicInfo.budgetMaxKrw }
  const departure = state.facts.departureWindow?.value
  const duration = state.facts.durationWeeks?.value
  return {
    ...basicInfo,
    budgetMinKrw: budgetRange.min,
    budgetMaxKrw: budgetRange.max,
    departureWindow: typeof departure === "string" ? departure : basicInfo.departureWindow,
    durationWeeks: typeof duration === "number" && Number.isInteger(duration) && duration >= CAMPFIT_V3_MIN_DURATION_WEEKS && duration <= CAMPFIT_V3_MAX_DURATION_WEEKS ? duration : basicInfo.durationWeeks,
  }
}

function markQuestionAsked(state: CampfitV3ConversationState, questionKey: string): CampfitV3ConversationState {
  if (state.askedQuestionKeys.includes(questionKey)) return { ...state, currentQuestionKey: questionKey }
  return {
    ...state,
    currentQuestionKey: questionKey,
    questionCount: Math.min(10, state.questionCount + 1),
    askedQuestionKeys: [...state.askedQuestionKeys, questionKey],
  }
}

function markQuestionCompleted(state: CampfitV3ConversationState, questionKey: string): CampfitV3ConversationState {
  return {
    ...state,
    completedQuestionKeys: Array.from(new Set([...state.completedQuestionKeys, questionKey])),
    failedQuestionKeys: state.failedQuestionKeys.filter((key) => key !== questionKey),
  }
}

function markQuestionFailed(state: CampfitV3ConversationState, questionKey: string | null): CampfitV3ConversationState {
  if (questionKey === null) return state
  return {
    ...state,
    completedQuestionKeys: state.completedQuestionKeys.filter((key) => key !== questionKey),
    failedQuestionKeys: Array.from(new Set([...state.failedQuestionKeys, questionKey])),
    currentQuestionKey: questionKey,
  }
}

function keepQuestionPending(state: CampfitV3ConversationState, questionKey: string): CampfitV3ConversationState {
  return {
    ...state,
    completedQuestionKeys: state.completedQuestionKeys.filter((key) => key !== questionKey),
    failedQuestionKeys: state.failedQuestionKeys.filter((key) => key !== questionKey),
    currentQuestionKey: questionKey,
  }
}

function buildDiagnostics(
  quickReplyKey: string | null,
  model: CampfitV3ModelResponse | null,
  provider: CampfitV3ProviderDiagnostic | null,
  targetUpdated: boolean,
): CampfitV3AiDiagnostics {
  if (quickReplyKey !== null) return noAiDiagnostics()
  const fallbackReason: CampfitV3FallbackReason = model !== null && !targetUpdated
    ? "target_slot_not_updated"
    : model === null
      ? provider?.code === undefined || provider.code === "ok"
        ? "provider_unavailable"
        : provider.code
      : null
  const providerRequestCount = provider?.requestCount ?? 0
  return {
    providerCallAttempted: providerRequestCount > 0,
    providerResponseReceived: provider?.providerResponseReceived ?? false,
    providerResponseValidated: model !== null,
    aiUsed: model !== null,
    fallbackReason,
    providerHttpStatus: provider?.httpStatus ?? null,
    providerErrorStatus: provider?.errorStatus ?? null,
    providerRequestCount,
    elapsedMs: provider?.elapsedMs ?? 0,
    ...(provider?.errorName === undefined ? {} : {
      errorName: provider.errorName ?? null,
      errorMessage: provider.errorMessage ?? null,
      causeName: provider.causeName ?? null,
      causeCode: provider.causeCode ?? null,
      causeErrno: provider.causeErrno ?? null,
      causeSyscall: provider.causeSyscall ?? null,
      causeHostname: provider.causeHostname ?? null,
      causeMessage: provider.causeMessage ?? null,
    }),
  }
}

function noAiDiagnostics(): CampfitV3AiDiagnostics {
  return {
    providerCallAttempted: false,
    providerResponseReceived: false,
    providerResponseValidated: false,
    aiUsed: false,
    fallbackReason: null,
    providerHttpStatus: null,
    providerErrorStatus: null,
    providerRequestCount: 0,
    elapsedMs: 0,
  }
}

function warningForDiagnostics(diagnostics: CampfitV3AiDiagnostics, targetUpdated: boolean, partialUnderstanding: boolean): string | null {
  if (partialUnderstanding && diagnostics.fallbackReason !== null) return "말씀해주신 내용을 기준으로 상담을 이어갈게요."
  if (targetUpdated && diagnostics.fallbackReason !== null) {
    return "AI 분석을 사용할 수 없어 입력 문장에서 확인 가능한 내용만 반영했습니다."
  }
  switch (diagnostics.fallbackReason) {
    case "provider_unavailable": return "AI 자유입력 분석을 사용할 수 없어 확인되지 않은 질문을 다시 표시합니다."
    case "timeout": return "AI 응답 시간이 초과되어 입력 문장에서 확인 가능한 내용만 반영했습니다."
    case "rate_limited": return "AI 사용량 제한으로 답변을 분석하지 못해 같은 질문을 다시 확인합니다."
    case "network_error":
    case "invalid_request":
    case "permission_denied":
    case "model_not_found":
    case "provider_cancelled":
    case "provider_internal":
    case "unknown_provider_error": return "AI 분석 요청이 완료되지 않아 입력 문장에서 확인 가능한 내용만 반영했습니다."
    case "empty_response":
    case "json_parse_failed":
    case "schema_validation_failed":
    case "semantic_validation_failed": return "AI 응답 형식을 확인하지 못해 입력 문장에서 확인 가능한 내용만 반영했습니다."
    case "target_slot_not_updated": return "답변에서 현재 질문의 조건을 확인하지 못했습니다."
    case null: return null
  }
}

export function cleanAcknowledgement(text: string): string {
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text];
  const cleanSentences = sentences
    .map((s) => s.trim())
    .filter((s) => {
      if (s.length === 0) return false;
      if (s.includes("?") || s.includes("？")) return false;
      if (
        s.includes("알려주세요") ||
        s.includes("말씀해 주세요") ||
        s.includes("말씀해주세요") ||
        s.includes("선택해 주세요") ||
        s.includes("적어주세요")
      ) {
        return false;
      }
      const cleanEnd = s.replace(/[.!]+$/, "").trim();
      const questionEndings = [
        "인가요",
        "있나요",
        "할까요",
        "싶으세요",
        "원하시나요",
        "어떻게 생각하세요",
        "무엇인가요",
        "어떤가요",
      ];
      if (questionEndings.some((ending) => cleanEnd.endsWith(ending))) {
        return false;
      }
      return true;
    });

  const sliced = cleanSentences.slice(0, 2);
  if (sliced.length === 0) {
    return "말씀해주신 내용을 확인했어요.";
  }
  return sliced.join(" ");
}

function buildGroundedAcknowledgement(
  facts: readonly CampfitV3Fact[],
  userMessage: string,
): { readonly text: string; readonly evidence: readonly CampfitV3AcknowledgementEvidence[] } {
  const specialCare = facts.find((fact) => fact.key === "specialCareFollowUp")
  if (specialCare !== undefined) {
    return {
      text: "별도로 확인할 사항의 존재 여부만 반영했어요. 상세 내용은 프로그램 상담 단계에서 확인해 주세요.",
      evidence: [toAcknowledgementEvidence(specialCare)],
    }
  }

  const parentNeeds = facts.find((fact) => fact.key === "parentExperienceNeeds")
  const participation = facts.find((fact) => fact.key === "participationProfile")
  const participationText = participationProfileAcknowledgement(participation?.value)
  if (participationText !== null && participation !== undefined) {
    const parentText = parentNeeds !== undefined && hasParentExperienceNeeds(parentNeeds.value)
      ? parentExperienceNeedsAcknowledgement(parentNeeds.value)
      : null
    if (parentNeeds !== undefined && parentText !== null && parentText !== participationText) {
      return {
        text: `${participationText} ${parentText}`,
        evidence: [toAcknowledgementEvidence(participation), toAcknowledgementEvidence(parentNeeds)],
      }
    }
    return { text: participationText, evidence: [toAcknowledgementEvidence(participation)] }
  }
  if (parentNeeds !== undefined && hasParentExperienceNeeds(parentNeeds.value)) {
    const text = parentExperienceNeedsAcknowledgement(parentNeeds.value)
    if (text !== null) return { text, evidence: [toAcknowledgementEvidence(parentNeeds)] }
  }

  const activities = facts.find((fact) => fact.key === "activityPreferences")
  if (activities !== undefined) {
    const text = activityPreferenceAcknowledgement(activities.value)
    if (text !== null) return { text, evidence: [toAcknowledgementEvidence(activities)] }
  }

  const english = englishAcknowledgement(facts)
  if (english !== null) return english

  return {
    text: dedupeMessage(fallbackAcknowledgement(facts, userMessage)),
    evidence: acknowledgementEvidenceForFallback(facts),
  }
}

function englishAcknowledgement(
  facts: readonly CampfitV3Fact[],
): { readonly text: string; readonly evidence: readonly CampfitV3AcknowledgementEvidence[] } | null {
  const level = facts.find((fact) => fact.key === "childEnglishLevel")
  const experience = facts.find((fact) => fact.key === "childEnglishExperience")
  const listening = facts.find((fact) => fact.key === "childEnglishListening")
  const speaking = facts.find((fact) => fact.key === "childEnglishSpeaking")
  const reading = facts.find((fact) => fact.key === "childEnglishReading")
  const usage = facts.find((fact) => fact.key === "childEnglishUsage")

  const compact = (
    text: string,
    usedFacts: readonly CampfitV3Fact[],
  ): { readonly text: string; readonly evidence: readonly CampfitV3AcknowledgementEvidence[] } => ({
    text,
    evidence: usedFacts.map(toAcknowledgementEvidence),
  })

  if (listening !== undefined && reading !== undefined && isValue(listening, "struggles_with_class_explanation") && isReadingFact(reading)) {
    return compact(
      "영어책 읽기는 가능하지만 영어로 설명을 들으면 이해하기 어려워하는 편이군요.",
      [reading, listening],
    )
  }
  if (listening !== undefined && speaking !== undefined && isPositiveListening(listening) && isValue(speaking, "difficulty_initiating")) {
    return compact(
      "영어 설명은 대체로 이해하지만 먼저 영어로 말하는 건 조금 어려워하는 편이군요.",
      [listening, speaking],
    )
  }
  if (listening !== undefined && speaking !== undefined
    && isValue(listening, "struggles_with_class_explanation")
    && (isValue(speaking, "can_converse") || isValue(speaking, "answers_simple_questions"))
    && hasFastListeningDifficulty(listening)) {
    return compact(
      isValue(speaking, "can_converse")
        ? "꾸준히 영어에 노출되어 간단한 일상대화는 가능하지만, 빠른 영어를 들을 때는 아직 부담이 있는 편이군요."
        : "짧은 대화나 질문에는 답할 수 있지만, 빠른 영어를 들을 때는 아직 부담이 있는 편이군요.",
      [listening, speaking],
    )
  }
  if (listening !== undefined && speaking !== undefined
    && isValue(listening, "struggles_with_class_explanation")
    && isValue(speaking, "can_converse")) {
    return compact(
      "영어로 간단한 대화는 가능하지만 긴 설명을 들을 때는 어려움을 느끼는 편이군요.",
      [listening, speaking],
    )
  }
  if (listening !== undefined && speaking !== undefined
    && isValue(listening, "struggles_with_class_explanation")
    && isValue(speaking, "answers_simple_questions")) {
    return compact(
      "간단한 수업 지시는 이해하지만 긴 설명은 어려워하고, 질문에는 단어나 짧은 문장으로 답할 수 있는 편이군요.",
      [listening, speaking],
    )
  }
  if (listening !== undefined && speaking !== undefined && isPositiveListening(listening) && isValue(speaking, "answers_simple_questions")) {
    return compact(
      "영어로 진행되는 수업을 이해하고 질문에도 답할 수 있는 편이군요.",
      [listening, speaking],
    )
  }
  if (speaking !== undefined && isValue(speaking, "can_present_in_english")) {
    return compact("영어로 수업을 듣고 발표하는 환경에도 무리 없이 참여하는 편이군요.", [speaking, ...(listening !== undefined && isPositiveListening(listening) ? [listening] : [])])
  }
  if (listening !== undefined && speaking !== undefined && isPositiveListening(listening) && isPositiveSpeaking(speaking)) {
    return compact(
      "영어 설명을 이해하고 영어로 표현하는 활동에도 무리 없이 참여하는 편이군요.",
      [listening, speaking],
    )
  }
  if (speaking !== undefined && isValue(speaking, "difficulty_initiating")) {
    return compact("영어로 먼저 말하는 데는 조금 자신 없어하는 편이군요.", [speaking])
  }
  if (level?.value === "beginner") return compact("아직 영어가 익숙하지 않은 단계군요.", [level])
  if (listening !== undefined && isPositiveListening(listening)) return compact(renderEnglishListening(listening.value) ?? "영어 설명은 이해하는 편이군요.", [listening])
  if (reading !== undefined && listening !== undefined && isReadingFact(reading) && isValue(listening, "struggles_with_class_explanation")) {
    return compact("영어 읽기와 듣기에서 편안함의 차이가 있는 편이군요.", [reading, listening])
  }
  const usageClause = renderEnglishUsage(usage?.value)
  if (usageClause !== null && usage !== undefined) return compact(`${usageClause}.`, [usage])
  if (renderEnglishExperience(experience?.value) !== null && experience !== undefined) {
    return compact("영어 학습 경험은 확인했어요. 실제로 영어를 듣고 말할 때의 편안함도 함께 살펴볼게요.", [experience])
  }
  if (Array.isArray(facts.find((fact) => fact.key === "childEnglishAssessment")?.value)) {
    const assessment = facts.find((fact) => fact.key === "childEnglishAssessment")
    if (assessment !== undefined) return compact("영어 평가 정보는 확인했어요. 실제로 영어를 듣고 말할 때의 편안함도 함께 살펴볼게요.", [assessment])
  }
  return null
}

function isValue(fact: CampfitV3Fact | undefined, value: string): boolean {
  return fact?.value === value
}

function hasFastListeningDifficulty(fact: CampfitV3Fact): boolean {
  return /빠른|빠르게|원어민이\s*빨리|놓쳐|속도가?\s*빠른/iu.test(fact.evidence)
}

function isPositiveListening(fact: CampfitV3Fact | undefined): boolean {
  return fact?.value === "understands_simple_instructions" || fact?.value === "understands_class_explanation"
}

function isPositiveSpeaking(fact: CampfitV3Fact | undefined): boolean {
  return fact?.value === "answers_simple_questions"
    || fact?.value === "can_converse"
    || fact?.value === "initiates_speech"
    || fact?.value === "can_present_in_english"
}

function isReadingFact(fact: CampfitV3Fact | undefined): boolean {
  return fact?.key === "childEnglishReading"
    && typeof fact.value === "string"
    && ["reads_simple_text", "reads_english_books", "understands_english_books"].includes(fact.value)
}

function renderEnglishExperience(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  const entries = value.filter(isEnglishExperienceValue)
  if (entries.length === 0) return null
  const labels = entries.map((entry) => {
    const label = entry.type === "english_kindergarten"
      ? "영어유치원"
      : entry.type === "english_academy"
        ? "영어학원"
        : entry.type === "english_class"
          ? "영어 수업"
          : "영어 몰입 환경"
    return entry.durationYears === null ? label : `${label} ${entry.durationYears}년`
  })
  const ongoing = entries
    .filter((entry) => entry.ongoing === true)
    .map((entry) => entry.type === "english_academy" ? "영어학원" : entry.type === "english_class" ? "영어 수업" : null)
    .filter((label) => label !== null)
  const uniqueLabels = Array.from(new Set(labels))
  const base = uniqueLabels.length <= 1 ? uniqueLabels[0] : `${uniqueLabels.slice(0, -1).join(", ")}과 ${uniqueLabels.at(-1)}`
  return ongoing.length > 0 ? `${base} 경험이 있고 지금도 ${Array.from(new Set(ongoing)).join("과 ")}에 다니거나 참여하고 있어요` : `${base} 경험이 있어요`
}

function renderEnglishListening(value: unknown): string | null {
  if (value === "understands_simple_instructions") return "외국인 선생님의 말이나 간단한 안내는 대체로 알아듣는 편이에요"
  if (value === "understands_class_explanation") return "영어 수업의 설명은 이해하고 따라가는 편이에요"
  if (value === "struggles_with_class_explanation") return "영어로 설명을 들으면 이해하기 어려워하는 편이에요"
  return null
}

function renderEnglishSpeaking(value: unknown): string | null {
  if (value === "difficulty_initiating") return "먼저 영어로 말하는 것은 조금 어려워하는 편이에요"
  if (value === "rarely_speaks") return "영어로 먼저 말하는 기회는 많지 않은 편이에요"
  if (value === "initiates_speech") return "먼저 영어로 말하는 것도 가능한 편이에요"
  if (value === "can_present_in_english") return "영어로 수업을 듣고 발표하는 것도 가능한 편이에요"
  if (value === "can_converse") return "영어로 대화할 수 있는 편이에요"
  if (value === "answers_simple_questions") return "간단한 질문에는 영어로 답할 수 있는 편이에요"
  return null
}

function renderEnglishUsage(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  if (value.includes("initiates_in_english")) return "영어로 먼저 말하는 경험도 있어요"
  if (value.includes("speaks_with_foreigners")) return "외국인과 영어로 대화하거나 어울리는 경험이 있어요"
  if (value.includes("answers_in_english")) return "영어 질문에 답하는 경험이 있어요"
  if (value.includes("difficulty_initiating")) return "영어로 먼저 말하는 것은 조금 어려워하는 편이에요"
  if (value.includes("rarely_uses_english")) return "실제로 영어를 사용하는 기회는 많지 않은 편이에요"
  return null
}

function isEnglishExperienceValue(value: unknown): value is {
  readonly type: "english_kindergarten" | "english_academy" | "english_class" | "english_immersion"
  readonly durationYears: number | null
  readonly ongoing: boolean | null
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record["type"] === "string"
    && ["english_kindergarten", "english_academy", "english_class", "english_immersion"].includes(record["type"] as string)
    && (record["durationYears"] === null || typeof record["durationYears"] === "number")
    && (record["ongoing"] === null || typeof record["ongoing"] === "boolean")
}

function toAcknowledgementEvidence(fact: CampfitV3Fact): CampfitV3AcknowledgementEvidence {
  return { factKey: fact.key, source: fact.source, evidence: fact.evidence }
}

function acknowledgementEvidenceForFallback(facts: readonly CampfitV3Fact[]): readonly CampfitV3AcknowledgementEvidence[] {
  const renderedKeys = new Set<CampfitV3FactKey>([
    "desiredOutcomes",
    "parentStayGoals",
    "worries",
    "programCommuteNeed",
    "programMealNeed",
    "participationProfile",
  ])
  return facts.filter((fact) => renderedKeys.has(fact.key)).map(toAcknowledgementEvidence)
}

function mentionsParentEnglishCommunication(message: string): boolean {
  return /(?:저는|제가|본인|부모|부모님|엄마|아빠|보호자).{0,32}(?:영어|basic\s*communication|소통|대화)/iu.test(message)
}

function mentionsKoreanSupportNeed(message: string): boolean {
  return /한국어\s*(?:지원|가능|통역|도움)|한국인\s*(?:매니저|스태프|선생님)|한국어가?\s*(?:필요|있으면|없어도)/iu.test(message)
}

function isEnglishEvidenceKey(key: CampfitV3FactKey): boolean {
  return key === "childEnglishExperience"
    || key === "childEnglishEnvironment"
    || key === "childEnglishAssessment"
    || key === "childEnglishListening"
    || key === "childEnglishSpeaking"
    || key === "childEnglishReading"
    || key === "childEnglishWriting"
    || key === "childEnglishUsage"
}

function isGroundedSupplementFactKey(key: CampfitV3FactKey): boolean {
  return isEnglishEvidenceKey(key) || key === "activityPreferences" || key === "participationProfile"
}

function parentNeedPriorityConflict(left: unknown, right: unknown): boolean {
  if (!isParentExperienceNeedsValue(left) || !isParentExperienceNeedsValue(right)) return false
  const primaryAxis = (value: typeof left): keyof typeof left | null => {
    const axes = Object.keys(value) as Array<keyof typeof value>
    return axes.find((axis) => value[axis].importance === "primary") ?? null
  }
  const leftPrimary = primaryAxis(left)
  const rightPrimary = primaryAxis(right)
  if (leftPrimary === null) return false
  if (rightPrimary === null || leftPrimary !== rightPrimary) return true
  const rightNeed = right[leftPrimary]
  return rightNeed.importance !== "primary"
}

function hasQuestionRelevantFacts(questionKey: string, facts: readonly CampfitV3Fact[]): boolean {
  return facts.some((fact) => {
    if (questionKey === "primary_experience_goal") {
      return fact.key === "parentExperienceNeeds"
        && hasParentExperienceNeeds(fact.value)
        || fact.key === "experienceGoals"
    }
    if (questionKey === "child_english_level") {
      return isEnglishEvidenceKey(fact.key) || fact.key === "childEnglishLevel"
    }
    if (questionKey === "child_activity_preferences") {
      return fact.key === "activityPreferences" && hasMeaningfulActivityEvidence(fact.value)
    }
    if (questionKey === "preferred_region") {
      return fact.key === "preferredRegions" || fact.key === "excludedRegions" || fact.key === "destinationPreference"
    }
    const question = getQuestion(questionKey)
    return question?.completedBy.includes(fact.key) ?? false
  })
}

function isEnglishModelFactSupportedByUserText(
  fact: CampfitV3ModelResponse["facts"][number],
  userMessage: string,
): boolean {
  const text = userMessage
  const normalizedMessage = normalizeForEnglishEvidence(userMessage)
  const normalizedEvidence = normalizeForEnglishEvidence(fact.evidence)
  if (normalizedEvidence.length === 0 || !normalizedMessage.includes(normalizedEvidence)) return false
  if (fact.key === "childEnglishListening") {
    const negativeListening = /(?:(?:이해|알아듣|따라|듣).{0,8}(?:못|안|않|어려|힘들|놓쳐|부담|버거)|(?:못|안|않|어려|힘들|놓쳐|부담|버거).{0,8}(?:이해|알아듣|따라|듣))/iu.test(fact.evidence)
    if (negativeListening && fact.value !== "struggles_with_class_explanation") return false
    return /알아듣|이해|설명|지시|안내|수업|따라|듣/iu.test(fact.evidence)
  }
  if (fact.key === "childEnglishSpeaking") {
    const negativeSpeaking = /(?:(?:질문|대답|답|응답|문장|표현|대화)[^.!?。！？]{0,12}(?:긴장|못|안|않|어려|힘들|자신\s*없)|(?:긴장|못|안|않|어려|힘들|자신\s*없)[^.!?。！？]{0,12}(?:질문|대답|답|응답|문장|표현|대화)|말(?:을|하기|하는|할)?\s*(?:긴장|못|안|않|어려|힘들|자신\s*없)|(?:긴장|못|안|않|어려|힘들|자신\s*없)[^.!?。！？]{0,8}말(?:을|하기|하는|할)?)/iu.test(fact.evidence)
    if (negativeSpeaking && !["difficulty_initiating", "rarely_speaks"].includes(fact.value as string)) return false
    return /질문|대답|답|응답|말|문장|표현|대화/iu.test(fact.evidence)
  }
  if (fact.key === "childEnglishReading") return /읽|책|파닉스|독해/iu.test(fact.evidence)
  if (fact.key === "childEnglishWriting") return /쓰|작문|문장/iu.test(fact.evidence)
  if (fact.key === "childEnglishUsage") return /쓰|사용|외국|원어민|친구|대화|질문|답|말/iu.test(fact.evidence)
  if (fact.key === "childEnglishEnvironment") return /국제학교|해외\s*(?:학교|캠프|거주)|외국\s*학교/iu.test(fact.evidence)
  if (fact.key === "childEnglishAssessment") return /AR|Lexile|시험|학교\s*영어|레벨|수준/iu.test(fact.evidence)
  if (fact.key === "childEnglishExperience") {
    const values = Array.isArray(fact.value) ? fact.value : [fact.value]
    return values.every((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false
      const type = (value as Record<string, unknown>)["type"]
      const durationYears = (value as Record<string, unknown>)["durationYears"]
      const ongoing = (value as Record<string, unknown>)["ongoing"]
      const context = type === "english_academy"
        ? /(영어\s*(?:학원|어학원))/iu
        : type === "english_class"
          ? /(영어\s*(?:수업|과외)|영어로\s*(?:하는\s*)?수업)/iu
          : type === "english_immersion"
            ? /(영어\s*(?:몰입|환경)|몰입\s*교육|영어로만)/iu
            : /(영어\s*유치원|영유)/iu
      const match = text.match(context)
      const durationText = match?.index === undefined ? "" : text.slice(match.index, match.index + 48)
      const ongoingBeforeText = match?.index === undefined ? "" : text.slice(Math.max(0, match.index - 20), match.index)
      const typeSupported = match !== null
      if (!typeSupported) return false
      if (typeof durationYears === "number" && !new RegExp(`${durationYears}\\s*년`, "iu").test(durationText)) return false
      if (ongoing === true && !/(?:계속|현재|지금도|다니고\s*있|재학)/iu.test(durationText + ongoingBeforeText)) return false
      if (ongoing === false && !/(?:그만|중단|예전|다녔지만|다녔고\s*(?:지금은|현재는)?)/iu.test(durationText + ongoingBeforeText)) return false
      return true
    })
  }
  return true
}

function normalizeForEnglishEvidence(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[.,!?;:()[\]{}"'`~\n\r\t]/gu, "")
    .replace(/\s+/gu, "")
}

function fallbackAcknowledgement(facts: readonly CampfitV3Fact[], userMessage: string): string {
  const parts: string[] = []
  const desiredOutcomes = stringArrayValue(facts.find((fact) => fact.key === "desiredOutcomes")?.value)
  const stayGoals = stringArrayValue(facts.find((fact) => fact.key === "parentStayGoals")?.value)
  const worries = stringArrayValue(facts.find((fact) => fact.key === "worries")?.value)
  if (desiredOutcomes.includes("english_exposure")) parts.push("영어 환경 경험과 앞으로의 영어 노출 계획")
  if (/(보호자|엄마|아빠|부모).{0,20}(같이|동행|함께|머물|갈)/u.test(userMessage)) parts.push("보호자 동반")
  if (stayGoals.includes("remoteWork")) parts.push("현지 원격근무 계획")
  if (worries.includes("medical_access")) parts.push("병원·의료 접근성")
  if (worries.includes("city_safety")) parts.push("도시 안전")
  if (worries.includes("foreign_friendliness")) parts.push("외국인 친화도")
  if (facts.some((fact) => fact.key === "programCommuteNeed" && fact.value === "simple_only")) parts.push("프로그램 이동 편의")
  if (facts.some((fact) => fact.key === "programMealNeed" && fact.value === "lunch_required")) parts.push("점심·도시락 조건")
  if (parts.length === 0 && facts.length > 0) return "말씀해주신 내용을 확인했어요."
  if (parts.length === 0) return "답변을 확인했어요."
  return `${joinKorean(parts)}을 확인했어요.`
}

function followUpQuestionText(
  question: ReturnType<typeof getQuestion>,
  transcript: readonly CampfitV3TranscriptMessage[],
  state: CampfitV3ConversationState,
): string {
  if (question === null) return "확인이 필요한 조건을 다시 살펴보고 있어요."
  if (question.key === "child_english_level") {
    const gap = englishEvidenceGap(state)
    if (gap === "classroom_comprehension") {
      const hasAssessment = Array.isArray(state.facts.childEnglishAssessment?.value)
        && state.facts.childEnglishAssessment.value.length > 0
      const hasSpeaking = state.facts.childEnglishSpeaking?.value !== undefined
        && state.facts.childEnglishSpeaking.value !== "unknown"
      if (hasAssessment && hasSpeaking) return "영어 평가 정보와 먼저 영어로 말하는 데 어려움은 이해했어요. 영어로 진행되는 수업에서 선생님의 설명은 대체로 이해하고 따라갈 수 있나요?"
      if (state.facts.childEnglishReading !== undefined) return "영어책 읽기와 듣기는 다를 수 있어요. 선생님이 영어로 설명할 때는 대체로 이해하고 따라갈 수 있나요?"
      return "영어로 진행되는 수업에서 선생님의 설명은 대체로 이해하고 따라갈 수 있나요?"
    }
    if (gap === "speaking") {
      if (state.facts.childEnglishListening?.value === "struggles_with_class_explanation") return "영어 설명을 듣는 부분은 확인했어요. 간단한 질문에 답하거나 먼저 영어로 말하는 건 어떤가요?"
      return "영어 설명은 이해하는 편이군요. 간단한 질문에 답하거나 먼저 영어로 말하는 건 어떤가요?"
    }
  }
  const previousAssistant = [...transcript].reverse().find((item) => item.role === "assistant")?.content
  if (previousAssistant !== undefined && normalizeMessage(previousAssistant) === normalizeMessage(question.title)) {
    return question.followUpTitle ?? "이 조건을 조금 더 구체적으로 알려주실 수 있을까요?"
  }
  return question.followUpTitle ?? question.title
}

function dedupeMessage(message: string): string {
  const paragraphs = message.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean)
  return Array.from(new Set(paragraphs)).join("\n\n")
}

function normalizeMessage(message: string): string {
  return message.replace(/\s+/gu, " ").trim()
}

function isNearDuplicate(candidate: string, previous: string): boolean {
  const candidateWords = normalizeMessage(candidate).split(" ").filter((word) => word.length >= 2)
  const previousWords = new Set(normalizeMessage(previous).split(" ").filter((word) => word.length >= 2))
  if (candidateWords.length < 5) return false
  const shared = candidateWords.filter((word) => previousWords.has(word)).length
  return shared >= 5 && shared / candidateWords.length >= 0.55
}

function stringArrayValue(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []
}

function joinKorean(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "말씀해주신 내용"
  return `${items.slice(0, -1).join(", ")}과 ${items[items.length - 1]}`
}

function isCorrectionLanguage(message: string): boolean {
  return /(아니라|아니고|바꿀|정정|수정|대신|이제는|잘못 말|아까|항공권 생각하면|다시 정리|정리할게)/.test(message)
}

function isSpecialCareAnswer(message: string): boolean {
  return extractDeterministicFacts(message, undefined, "special_care_follow_up")
    .some((fact) => fact.key === "specialCareFollowUp")
}

function isBudgetRange(value: unknown): value is { readonly min: number; readonly max: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record["min"] === "number" && typeof record["max"] === "number" && record["min"] <= record["max"]
}
