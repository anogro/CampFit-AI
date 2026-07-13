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
