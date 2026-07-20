import { allowedQuestionKeys, getQuestion, isQuestionCompleted, selectNextQuestion } from "@/lib/campfit/v3/questionBank"
import { calculateProgress, isReadyForRecommendation, progressMessage } from "@/lib/campfit/v3/progress"
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
} from "@/lib/campfit/v3/stateEngine"
import type {
  CampfitV3LLMProvider,
  CampfitV3ModelResponse,
  CampfitV3ProviderDiagnostic,
} from "@/lib/campfit/v3/provider"
import type {
  CampfitV3AiDiagnostics,
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
    deterministicFacts = privacySafeFacts
    const deterministic = markChangedExplicitFactsAsCorrections(
      state,
      deterministicFacts,
      isCorrectionLanguage(input.userMessage),
    )
    state = mergeFacts(state, deterministic)
    model = await input.provider.analyzeConversation({
      transcript: safeTranscript,
      currentState: state,
      basicInfo: applyBasicInfoFacts(input.basicInfo, state),
      userMessage: safeUserMessage,
      allowedQuestionKeys: allowedQuestionKeys(state),
    })
    providerDiagnostic = input.provider.getLastDiagnostic?.() ?? null
    if (model !== null) state = mergeModelResponse(state, model, safeUserMessage)
  }

  const partialUnderstanding = deterministicFacts.length > 0 || (model?.facts.length ?? 0) > 0
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
  const nextQuestion = ready && !continuingReadySession
    ? null
    : selectNextQuestion(state, model?.suggestedNextQuestionKey ?? null)
  if (nextQuestion !== null) state = markQuestionAsked(state, nextQuestion.key)
  else state = { ...state, currentQuestionKey: null }

  const calculatedProgress = calculateProgress(updatedBasicInfo, state)
  const progress = ready ? 100 : Math.max(input.currentState.progress, calculatedProgress)
  state = { ...state, progress }

  const targetUpdated = currentQuestion === null || state.completedQuestionKeys.includes(currentQuestion.key)
  const diagnostics = buildDiagnostics(input.quickReplyKey, model, providerDiagnostic, targetUpdated)
  const diagnosticWarning = warningForDiagnostics(diagnostics, targetUpdated, partialUnderstanding)
  if (diagnosticWarning !== null) warnings.push(diagnosticWarning)
  const maxReached = !ready && nextQuestion === null && state.questionCount >= 10
  if (maxReached) warnings.push("최대 질문 수에 도달했지만 필수 조건이 남아 있어 결과를 만들지 않았습니다.")

  const nextQuestionText = currentQuestion === null || targetUpdated
    ? nextQuestion?.title ?? "확인이 필요한 조건을 다시 살펴보고 있어요."
    : followUpQuestionText(currentQuestion, input.transcript)
  const assistantMessage = ready
    ? "필요한 내용을 모두 확인했어요. 지금 조건에 맞는 경험 방향과 도시, 프로그램 후보를 정리해볼게요."
      : currentQuestion !== null && !targetUpdated
      ? partialUnderstanding
        ? `${acknowledgement(model, deterministicFacts, input.userMessage, input.transcript)}\n\n${nextQuestionText}`
        : `아직 답변을 충분히 파악하지 못했어요.\n\n${nextQuestionText}`
      : `${acknowledgement(model, deterministicFacts, input.userMessage, input.transcript)}\n\n${nextQuestionText}`

  return {
    assistantMessage,
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

function mergeModelResponse(
  state: CampfitV3ConversationState,
  model: CampfitV3ModelResponse,
  userMessage: string,
): CampfitV3ConversationState {
  const facts = model.facts.flatMap((fact): readonly CampfitV3Fact[] => {
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

function acknowledgement(
  model: CampfitV3ModelResponse | null,
  deterministicFacts: readonly CampfitV3Fact[],
  userMessage: string,
  transcript: readonly CampfitV3TranscriptMessage[],
): string {
  const candidate = model === null
    ? fallbackAcknowledgement(deterministicFacts, userMessage)
    : model.facts.some((fact) => fact.key === "specialCareFollowUp")
      ? "별도로 확인할 사항의 존재 여부만 반영했어요. 상세 내용은 프로그램 상담 단계에서 확인해 주세요."
      : cleanAcknowledgement(model.assistantMessage)
  const previousAssistant = [...transcript].reverse().find((item) => item.role === "assistant")?.content
  if (model !== null && previousAssistant !== undefined && normalizeMessage(candidate).includes(normalizeMessage(previousAssistant))) {
    return fallbackAcknowledgement(deterministicFacts, userMessage)
  }
  return dedupeMessage(candidate)
}

function fallbackAcknowledgement(facts: readonly CampfitV3Fact[], userMessage: string): string {
  const parts: string[] = []
  const desiredOutcomes = stringArrayValue(facts.find((fact) => fact.key === "desiredOutcomes")?.value)
  const stayGoals = stringArrayValue(facts.find((fact) => fact.key === "parentStayGoals")?.value)
  if (desiredOutcomes.includes("english_exposure")) parts.push("영어 환경 경험과 앞으로의 영어 노출 계획")
  if (/(보호자|엄마|아빠|부모).{0,20}(같이|동행|함께|머물|갈)/u.test(userMessage)) parts.push("보호자 동반")
  if (stayGoals.includes("remoteWork")) parts.push("현지 원격근무 계획")
  if (parts.length === 0 && facts.length > 0) return "말씀해주신 내용을 확인했어요."
  if (parts.length === 0) return "답변을 확인했어요."
  return `${joinKorean(parts)}을 확인했어요.`
}

function followUpQuestionText(question: ReturnType<typeof getQuestion>, transcript: readonly CampfitV3TranscriptMessage[]): string {
  if (question === null) return "확인이 필요한 조건을 다시 살펴보고 있어요."
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
