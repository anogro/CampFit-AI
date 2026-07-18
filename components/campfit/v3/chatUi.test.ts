import { describe, expect, it } from "vitest"
import { appendOptimisticUserMessage, isChatNearBottom, shouldSendChatMessage } from "@/components/campfit/v3/chatUi"

describe("CampFit v3 chat UI helpers", () => {
  it("sends a plain Enter key", () => {
    expect(shouldSendChatMessage({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, repeat: false })).toBe(true)
  })

  it("keeps Shift+Enter as a newline", () => {
    expect(shouldSendChatMessage({ key: "Enter", shiftKey: true, isComposing: false, keyCode: 13, repeat: false })).toBe(false)
  })

  it("does not send while an IME composition is being confirmed", () => {
    expect(shouldSendChatMessage({ key: "Enter", shiftKey: false, isComposing: true, keyCode: 13, repeat: false })).toBe(false)
    expect(shouldSendChatMessage({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 229, repeat: false })).toBe(false)
  })

  it("does not send other or repeated keys", () => {
    expect(shouldSendChatMessage({ key: "Space", shiftKey: false, isComposing: false, keyCode: 32, repeat: false })).toBe(false)
    expect(shouldSendChatMessage({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, repeat: true })).toBe(false)
  })

  it("recognizes the bottom and a nearby scroll position", () => {
    expect(isChatNearBottom({ scrollHeight: 700, scrollTop: 300, clientHeight: 400 })).toBe(true)
    expect(isChatNearBottom({ scrollHeight: 700, scrollTop: 220, clientHeight: 400 })).toBe(true)
  })

  it("does not treat an older message position as near the bottom", () => {
    expect(isChatNearBottom({ scrollHeight: 1_200, scrollTop: 400, clientHeight: 500 })).toBe(false)
  })

  it("appends exactly one serializable user message for optimistic rendering", () => {
    const transcript = [{ role: "assistant" as const, content: "질문", questionKey: "child_english_level" }]
    const next = appendOptimisticUserMessage(transcript, "영어는 초급이에요", "child_english_level")

    expect(next).toHaveLength(2)
    expect(next[1]).toEqual({ role: "user", content: "영어는 초급이에요", questionKey: "child_english_level" })
    expect(JSON.stringify(next)).not.toContain("typing")
  })
})
