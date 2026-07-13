import { describe, expect, it } from "vitest"
import { sanitizeConversationInput, sanitizeSpecialCareInput } from "@/components/campfit/v3/conversationInput"

describe("sanitizeSpecialCareInput", () => {
  it.each([
    "없어요",
    "없습니다",
    "없음",
    "따로 없어요",
    "특별한 사항 없습니다",
    "아니요",
  ])("일반적인 부정 응답을 none으로 일반화한다: %s", (input) => {
    expect(sanitizeSpecialCareInput(input)).toEqual({ followUp: "none", safeMessage: "없어요" })
  })

  it("별도 확인이 필요한 응답은 상세 원문을 보존하지 않는다", () => {
    expect(sanitizeSpecialCareInput("상담할 때 확인할 게 있어요")).toEqual({
      followUp: "required",
      safeMessage: "있어요. 상담할 때 별도로 확인할게요",
    })
    expect(sanitizeSpecialCareInput("복용 중인 상세 내용을 적었습니다").safeMessage).not.toContain("복용")
  })

  it.each(["잘 모르겠어요", "확인해 봐야 해요"])("불확실한 응답을 unknown으로 일반화한다: %s", (input) => {
    expect(sanitizeSpecialCareInput(input)).toEqual({ followUp: "unknown", safeMessage: "아직 잘 모르겠어요" })
  })
})

describe("sanitizeConversationInput", () => {
  it("다른 질문에 자발적으로 적은 상세 건강 문장도 브라우저 transcript에서 일반화한다", () => {
    const result = sanitizeConversationInput("복용약 이름과 알레르기 내용을 적었습니다", false)
    expect(result.healthDetailRedacted).toBe(true)
    expect(result.safeMessage).toBe("있어요. 상담할 때 별도로 확인할게요")
    expect(result.safeMessage).not.toContain("알레르기")
  })

  it("일반 상담 문장과 '약간' 같은 표현은 변경하지 않는다", () => {
    const message = "한국어 지원은 약간 있으면 좋지만 매일 필요하지 않아요"
    expect(sanitizeConversationInput(message, false)).toEqual({ safeMessage: message, healthDetailRedacted: false })
  })
})
