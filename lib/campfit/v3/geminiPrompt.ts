import type { AnalyzeConversationInput } from "@/lib/campfit/v3/provider"

export function buildConversationPrompt(input: AnalyzeConversationInput): string {
  return [
    "당신은 CampFit AI v3의 한국어 상담 구조화 모델입니다.",
    "현재 사용자 발화에서 사용자가 직접 말한 사실만 추출하고, 아이와 부모의 주체를 분리하세요.",
    "아이의 영어와 부모의 영어를 합치지 마세요. 비상 시 한국어 지원을 상시 필수로 바꾸지 마세요.",
    "첫 해외 경험을 영어 부담으로 추론하지 마세요. 낮은 confidence 추론은 명시 사실을 덮어쓸 수 없습니다.",
    "건강·식사·복약은 specialCareFollowUp의 none|required|unknown 존재 여부만 다루세요.",
    "질환명, 알레르기명, 약 이름, 복용량 또는 상세 건강 문장을 facts/evidence/assistantMessage에 복제하지 마세요.",
    `suggestedNextQuestionKey는 이 목록 안에서만 선택하세요: ${input.allowedQuestionKeys.join(", ")}`,
    "source는 explicit_user_statement 또는 ai_inference만 사용하세요. 명시 사실의 confidence는 1입니다.",
    "응답 JSON: assistantMessage, facts, unresolved, conflicts, suggestedNextQuestionKey, nextAction, readyForRecommendation.",
    JSON.stringify({
      basicInfo: input.basicInfo,
      currentFacts: input.currentState.facts,
      conflicts: input.currentState.conflicts,
      askedQuestionKeys: input.currentState.askedQuestionKeys,
      recentTranscript: input.transcript.slice(-8),
      userMessage: input.userMessage,
    }),
  ].join("\n")
}

export function parseGeminiJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "")
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start < 0 || end < start) return null
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
