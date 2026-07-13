import { allowedQuestionKeys, getQuestion, selectNextQuestion } from "@/lib/campfit/v3/questionBank"
import { calculateProgress, isReadyForRecommendation, progressMessage } from "@/lib/campfit/v3/progress"
import { applyQuickReply, createFact, createInitialConversationState, extractDeterministicFacts, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3LLMProvider, CampfitV3ModelResponse } from "@/lib/campfit/v3/provider"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationResponse,
  CampfitV3ConversationState,
  CampfitV3Fact,
  CampfitV3TranscriptMessage,
} from "@/types/campfitV3"

export function startConversation(basicInfo: CampfitV3BasicInfo): CampfitV3ConversationResponse {
  const initial = createInitialConversationState()
  const question = selectNextQuestion(initial)
  const state = question === null ? initial : markQuestionAsked(initial, question.key)
  const progress = calculateProgress(basicInfo, state)
  return {
    assistantMessage: question?.title ?? "기본 조건을 확인했어요.",
    updatedState: state,
    quickReplies: question?.quickReplies ?? [],
    questionKey: question?.key ?? null,
    progress,
    progressMessage: progressMessage(progress),
    readyForRecommendation: false,
    conflicts: [],
    warnings: [],
    aiUsed: false,
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
  if (input.quickReplyKey !== null && currentQuestion !== null) {
    const label = currentQuestion.quickReplies.find((reply) => reply.key === input.quickReplyKey)?.label ?? input.userMessage
    state = applyQuickReply(state, currentQuestion.key, input.quickReplyKey, label)
  }
  state = mergeFacts(state, extractDeterministicFacts(input.userMessage))

  const model = input.quickReplyKey === null
    ? await input.provider.analyzeConversation({
        transcript: input.transcript,
        currentState: state,
        basicInfo: input.basicInfo,
        userMessage: input.userMessage,
        allowedQuestionKeys: allowedQuestionKeys(state),
      })
    : null
  if (model !== null) state = mergeModelResponse(state, model)

  const ready = isReadyForRecommendation(state)
  const nextQuestion = ready ? null : selectNextQuestion(state)
  if (nextQuestion !== null) state = markQuestionAsked(state, nextQuestion.key)
  else state = { ...state, currentQuestionKey: null }

  const progress = calculateProgress(input.basicInfo, state)
  const maxReached = !ready && state.questionCount >= 10
  const assistantMessage = ready
    ? "필요한 내용을 충분히 확인했어요. 지금 조건에 맞는 경험 방향과 도시, 프로그램 후보를 정리해볼게요."
    : maxReached
      ? "확인한 내용을 기준으로 결과를 정리할게요. 아직 확인되지 않은 내용은 최종 확인사항에 남겨두겠습니다."
      : `${acknowledgement(model)}\n\n${nextQuestion?.title ?? "현재 확인한 내용을 정리하고 있어요."}`

  return {
    assistantMessage,
    updatedState: state,
    quickReplies: nextQuestion?.quickReplies ?? [],
    questionKey: nextQuestion?.key ?? null,
    progress,
    progressMessage: progressMessage(progress),
    readyForRecommendation: ready,
    conflicts: state.conflicts,
    warnings: maxReached ? ["최대 질문 수에 도달해 일부 조건은 결과에서 확인사항으로 안내합니다."] : [],
    aiUsed: model !== null,
  }
}

function mergeModelResponse(state: CampfitV3ConversationState, model: CampfitV3ModelResponse): CampfitV3ConversationState {
  const facts = model.facts.flatMap((fact): readonly CampfitV3Fact[] => {
    if (fact.key === "specialCareFollowUp" && !["none", "required", "unknown"].includes(String(fact.value))) return []
    const evidence = fact.key === "specialCareFollowUp" ? "특별관리 후속 확인 여부를 자연어로 답함" : fact.evidence
    return [createFact({
      key: fact.key,
      subject: fact.subject,
      value: fact.value,
      source: fact.source,
      confidence: fact.source === "explicit_user_statement" ? 1 : fact.confidence,
      evidence,
    })]
  })
  const merged = mergeFacts(state, facts)
  return {
    ...merged,
    unresolved: Array.from(new Set([...merged.unresolved, ...model.unresolved])),
    conflicts: model.conflicts,
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

function acknowledgement(model: CampfitV3ModelResponse | null): string {
  if (model === null) return "답변을 확인했어요."
  if (model.facts.some((fact) => fact.key === "specialCareFollowUp")) return "별도로 확인할 사항의 존재 여부만 반영했어요. 상세 내용은 프로그램 상담 단계에서 확인해 주세요."
  return model.assistantMessage
}
