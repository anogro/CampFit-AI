import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CampFitV3Chat } from "@/components/campfit/v3/CampFitV3Chat"
import type { CampfitV3BasicInfo, CampfitV3ConversationResponse, CampfitV3ConversationState } from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "2026년 12월",
  durationWeeks: 4,
  budgetMinKrw: 8_000_000,
  budgetMaxKrw: 12_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const state: CampfitV3ConversationState = {
  facts: {},
  askedQuestionKeys: [],
  completedQuestionKeys: [],
  failedQuestionKeys: [],
  currentQuestionKey: null,
  questionCount: 0,
  progress: 68,
  unresolved: [],
  conflicts: [],
}

describe("CampFit v3 chat status UI", () => {
  it("renders one consistent in-progress status across the chat panels", () => {
    const markup = renderToStaticMarkup(createElement(CampFitV3Chat, {
      basicInfo,
      conversation: conversation(false),
      transcript: [{ role: "assistant", content: "질문" }],
      onAnswer: vi.fn(async () => true),
      onEditBasic: vi.fn(),
      onResult: vi.fn(async () => undefined),
    }))

    expect(markup).toContain("현재 상담 중")
    expect(markup).toContain("상담 정보 정리")
    expect(markup).toContain("68%")
    expect(markup).toContain("아이에게 맞는 선택지를 찾기 위해 몇 가지만 더 여쭤볼게요.")
    expect(markup).not.toContain("결과 준비 완료")
  })

  it("renders readyForRecommendation without progress-state copy", () => {
    const markup = renderToStaticMarkup(createElement(CampFitV3Chat, {
      basicInfo,
      conversation: conversation(true),
      transcript: [{ role: "assistant", content: "질문" }],
      onAnswer: vi.fn(async () => true),
      onEditBasic: vi.fn(),
      onResult: vi.fn(async () => undefined),
    }))

    expect(markup).toContain("결과 준비 완료")
    expect(markup).toContain("상담 정보 정리")
    expect(markup).toContain("추천 준비 완료")
    expect(markup).toContain("필요한 정보를 모두 확인했어요. 맞춤 결과를 확인해 보세요.")
    expect(markup).not.toContain("현재 상담 중")
    expect(markup).not.toContain("추천 조건 확인 중")
    expect(markup).not.toContain("추천 가능 조건 100%")
    expect(markup).not.toContain("추천에 필요한 조건을 정리했어요")
  })
})

function conversation(readyForRecommendation: boolean): CampfitV3ConversationResponse {
  return {
    assistantMessage: "질문",
    updatedState: state,
    updatedBasicInfo: basicInfo,
    quickReplies: [],
    questionKey: null,
    progress: 68,
    progressMessage: "추천에 필요한 조건을 정리했어요. 결과를 확인해 주세요",
    readyForRecommendation,
    conflicts: [],
    warnings: [],
    aiUsed: false,
  }
}
