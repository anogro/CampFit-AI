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
