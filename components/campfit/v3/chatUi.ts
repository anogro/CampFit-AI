import type { CampfitV3TranscriptMessage } from "@/types/campfitV3"

export type ChatComposerKeyInput = {
  readonly key: string
  readonly shiftKey: boolean
  readonly isComposing: boolean
  readonly keyCode: number
  readonly repeat: boolean
}

export type ChatScrollMetrics = {
  readonly scrollHeight: number
  readonly scrollTop: number
  readonly clientHeight: number
}

export type CampfitV3ChatStatus = {
  readonly statusLabel: string
  readonly title: string
  readonly valueLabel: string
  readonly description: string
}

export function getCampfitV3ChatStatus(
  readyForRecommendation: boolean,
  progress: number,
): CampfitV3ChatStatus {
  if (readyForRecommendation) {
    return {
      statusLabel: "결과 준비 완료",
      title: "상담 정보 정리",
      valueLabel: "추천 준비 완료",
      description: "필요한 정보를 모두 확인했어요. 맞춤 결과를 확인해 보세요.",
    }
  }

  return {
    statusLabel: "현재 상담 중",
    title: "상담 정보 정리",
    valueLabel: `${progress}%`,
    description: "아이에게 맞는 선택지를 찾기 위해 몇 가지만 더 여쭤볼게요.",
  }
}

export function appendOptimisticUserMessage(
  transcript: readonly CampfitV3TranscriptMessage[],
  content: string,
  questionKey: string | null,
): readonly CampfitV3TranscriptMessage[] {
  const userMessage: CampfitV3TranscriptMessage = questionKey === null
    ? { role: "user", content }
    : { role: "user", content, questionKey }
  return [...transcript, userMessage]
}

export function shouldSendChatMessage(input: ChatComposerKeyInput): boolean {
  return input.key === "Enter"
    && !input.shiftKey
    && !input.isComposing
    && input.keyCode !== 229
    && !input.repeat
}

export function isChatNearBottom(metrics: ChatScrollMetrics, threshold = 96): boolean {
  const safeThreshold = Math.max(0, threshold)
  const distanceFromBottom = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
  return distanceFromBottom <= safeThreshold
}
