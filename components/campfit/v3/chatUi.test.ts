import { describe, expect, it } from "vitest"
import { appendOptimisticUserMessage, getCampfitV3ChatStatus, isChatNearBottom, shouldSendChatMessage } from "@/components/campfit/v3/chatUi"

describe("CampFit v3 chat UI helpers", () => {
  it("uses the same in-progress status for desktop and mobile", () => {
    expect(getCampfitV3ChatStatus(false, 68)).toEqual({
      statusLabel: "현재 상담 중",
      title: "상담 정보 정리",
      valueLabel: "68%",
      description: "아이에게 맞는 선택지를 찾기 위해 몇 가지만 더 여쭤볼게요.",
    })
  })

  it("uses readyForRecommendation for the completed status instead of progress", () => {
    const status = getCampfitV3ChatStatus(true, 68)

    expect(status).toEqual({
      statusLabel: "결과 준비 완료",
      title: "상담 정보 정리",
      valueLabel: "추천 준비 완료",
      description: "필요한 정보를 모두 확인했어요. 맞춤 결과를 확인해 보세요.",
    })
    expect(JSON.stringify(status)).not.toContain("현재 상담 중")
    expect(JSON.stringify(status)).not.toContain("추천 조건 확인 중")
    expect(status.valueLabel).not.toContain("%")
  })

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
