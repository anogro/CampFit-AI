import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CampFitV3Result } from "@/components/campfit/v3/CampFitV3Result"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3RecommendationResult,
} from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "2026년 8월",
  durationWeeks: 3,
  budgetMinKrw: 8_000_000,
  budgetMaxKrw: 12_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const conversationState: CampfitV3ConversationState = {
  facts: {
    childEnglishLevel: { key: "childEnglishLevel", subject: "child", value: "basic", source: "quick_reply", confidence: 1, status: "confirmed", evidence: "단어·짧은 표현 정도예요", updatedAt: "" },
    parentStayGoals: { key: "parentStayGoals", subject: "parent", value: ["remoteWork"], source: "explicit_user_statement", confidence: 1, status: "confirmed", evidence: "원격근무 선호", updatedAt: "" },
  },
  askedQuestionKeys: [],
  completedQuestionKeys: [],
  failedQuestionKeys: [],
  currentQuestionKey: null,
  questionCount: 0,
  progress: 100,
  unresolved: [],
  conflicts: [],
}

const result: CampfitV3RecommendationResult = {
  consultingConclusion: "조건에 맞춤 정리된 결론입니다.",
  experienceDirections: [
    { key: "schoolSchooling", label: "학교·스쿨링 경험", fitLabel: "가장 잘 맞는 방향", score: 85, explanation: "스쿨링 설명" },
    { key: "englishIntensive", label: "영어 집중 경험", fitLabel: "조건을 조정하면 가능", score: 60, explanation: "영어 몰입 설명" },
    { key: "cultureActivity", label: "문화·활동 경험", fitLabel: "현재 우선순위가 낮음", score: 20, explanation: "낮은 우선순위 설명" },
  ],
  destinationRecommendations: [
    { cityId: "singapore", cityName: "싱가포르", countryName: "싱가포르", role: "가장 균형 잡힌 선택", imageUrl: null, reason: "이유", verify: [], costEstimate: { label: "비교용 추정", estimatedTotalMinKrw: 5000000, estimatedTotalMaxKrw: 8000000, confidence: "medium", includedComponents: [], missingComponents: [] } }
  ],
  requiredSupportConditions: ["지원조건"],
  programCandidates: [
    { programId: "prog-1", name: "싱가포르 STEM 캠프", cityName: "싱가포르", countryName: "싱가포르", group: "우선 살펴볼 프로그램", ageLabel: "만 8세", durationLabel: "3주", priceLabel: "300만원", reason: "이유", verify: [], detailUrl: null, imageUrl: null, primaryDirection: "subjectProject", score: 95 }
  ],
  verificationChecklist: ["확인사항"],
  alternatives: ["대안"],
  limitedResult: false,
  catalogSource: "demo",
}

describe("CampFitV3Result UI component", () => {
  it("hides low priority experience directions and maps conditional labels", () => {
    const markup = renderToStaticMarkup(
      createElement(CampFitV3Result, {
        result,
        basicInfo,
        conversationState,
        onBack: vi.fn(),
        onRestart: vi.fn(),
      })
    )

    // 1. Should contain primary direction
    expect(markup).toContain("학교·스쿨링 경험")
    expect(markup).toContain("가장 잘 맞는 방향")

    // 2. Should map "조건을 조정하면 가능" to "조건을 조정하면 함께 검토할 수 있어요"
    expect(markup).toContain("조건을 조정하면 함께 검토할 수 있어요")
    expect(markup).not.toContain('font-bold text-[var(--accent-primary)]">조건을 조정하면 가능')

    // 3. Should filter out "현재 우선순위가 낮음" directions
    expect(markup).not.toContain("문화·활동 경험")
    expect(markup).not.toContain("낮은 우선순위 설명")
  })

  it("presents basic English as words and short phrases without overstating fluency", () => {
    const markup = renderToStaticMarkup(
      createElement(CampFitV3Result, {
        result,
        basicInfo,
        conversationState,
        onBack: vi.fn(),
        onRestart: vi.fn(),
      })
    )

    expect(markup).toContain("단어·짧은 표현 수준")
    expect(markup).not.toContain("기본 회화 가능")
  })

  it("renders the email CTA button with corrected copy", () => {
    const markup = renderToStaticMarkup(
      createElement(CampFitV3Result, {
        result,
        basicInfo,
        conversationState,
        onBack: vi.fn(),
        onRestart: vi.fn(),
      })
    )

    expect(markup).toContain("이메일로 받기")
    expect(markup).not.toContain("이메일로 받기 · 준비 중")
  })
})
