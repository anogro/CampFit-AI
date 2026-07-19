import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CampFitV3Result } from "@/components/campfit/v3/CampFitV3Result"
import type { CampfitV3TripCost, TripCostLine } from "@/lib/campfit/v3/cost/types"
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

const tripCost: CampfitV3TripCost = {
  currency: "KRW",
  totalLow: 8_000_000,
  totalHigh: 10_000_000,
  confidence: "medium",
  priceStatus: "estimated",
  calculatedAt: "2026-07-19T00:00:00.000Z",
  assumptions: ["성인 1명·아동 1명 전체 여행비 기준"],
  unresolvedItems: ["확인 필요: 보험·비자"],
  breakdown: {
    program: testLine("exact", 3_000_000, 3_000_000),
    accommodation: testLine("included", 0, 0),
    flights: testLine("estimated", 1_000_000, 1_500_000),
    living: testLine("estimated", 2_000_000, 3_000_000),
    localTransport: testLine("estimated", 500_000, 800_000),
    other: { ...testLine("inquiry", 0, 0), items: ["보험·비자"] },
  },
}

const result: CampfitV3RecommendationResult = {
  consultingConclusion: "조건에 맞춤 정리된 결론입니다.",
  experienceDirections: [
    { key: "schoolSchooling", label: "학교·스쿨링 경험", fitLabel: "가장 잘 맞는 방향", score: 85, explanation: "스쿨링 설명" },
    { key: "englishIntensive", label: "영어 집중 경험", fitLabel: "조건을 조정하면 가능", score: 60, explanation: "영어 몰입 설명" },
    { key: "cultureActivity", label: "문화·활동 경험", fitLabel: "현재 우선순위가 낮음", score: 20, explanation: "낮은 우선순위 설명" },
  ],
  destinationRecommendations: [
    { cityId: "singapore", cityName: "싱가포르", countryName: "싱가포르", role: "가장 균형 잡힌 선택", imageUrl: null, reason: "이유", verify: [], costEstimate: { label: "비교용 추정", estimatedTotalMinKrw: 5000000, estimatedTotalMaxKrw: 8000000, confidence: "medium", includedComponents: [], missingComponents: [] }, tripCost }
  ],
  requiredSupportConditions: ["지원조건"],
  programCandidates: [
    { programId: "prog-1", name: "싱가포르 STEM 캠프", cityName: "싱가포르", countryName: "싱가포르", group: "우선 살펴볼 프로그램", ageLabel: "만 8세", durationLabel: "3주", priceLabel: "300만원", reason: "이유", verify: [], detailUrl: null, imageUrl: null, primaryDirection: "subjectProject", score: 95, tripCost }
  ],
  verificationChecklist: ["확인사항"],
  alternatives: ["대안"],
  limitedResult: false,
  catalogSource: "supabase",
}

describe("CampFitV3Result UI component", () => {
  it("builds a parent-readable saved report in the intended order", () => {
    const markup = renderToStaticMarkup(
      createElement(CampFitV3Result, {
        result,
        basicInfo,
        conversationState,
        onBack: vi.fn(),
        onRestart: vi.fn(),
      })
    )

    expect(markup).toContain("CampFit AI 추천 리포트")
    expect(markup).toContain("생성일")
    expect(markup).toContain("우리 가족 조건")
    expect(markup).toContain("AI 요약")
    expect(markup).toContain("추천 도시 Top3")
    expect(markup).toContain("도시 비교")
    expect(markup).toContain("확인해야 할 사항")
    expect(markup).toContain("추천 이유와 장점")
    expect(markup).toContain("Best Match")
    expect(markup).toContain("이 도시에서 볼 프로그램")
    expect(markup).toContain("도시별 총여행비와 추천 조건 비교")
    expect(markup).toContain('data-campfit-export-root="true"')
    expect(markup).toContain('data-campfit-export-ignore="true"')
    expect(markup).not.toContain("프로그램 선택지")
    expect(markup.indexOf("CampFit AI 추천 리포트")).toBeLessThan(markup.indexOf("우리 가족 조건"))
    expect(markup.indexOf("우리 가족 조건")).toBeLessThan(markup.indexOf("AI 요약"))
    expect(markup.indexOf("AI 요약")).toBeLessThan(markup.indexOf("추천 도시 Top3"))
    expect(markup.indexOf("추천 도시 Top3")).toBeLessThan(markup.indexOf("도시 비교"))
    expect(markup.indexOf("도시 비교")).toBeLessThan(markup.indexOf("확인해야 할 사항"))
    expect(markup.indexOf("결과를 저장해두세요")).toBeGreaterThan(markup.indexOf("확인해야 할 사항"))
    expect(markup).toContain("비용과 세부 정보 보기")
    expect(markup).not.toContain("가장 잘 맞는 방향")
    expect(markup).not.toContain("낮은 우선순위 설명")
  })

  it("keeps report city and program cards tied to real result records", () => {
    const markup = renderToStaticMarkup(
      createElement(CampFitV3Result, {
        result,
        basicInfo,
        conversationState,
        onBack: vi.fn(),
        onRestart: vi.fn(),
      })
    )

    expect(markup).toContain('data-campfit-city-card="true" data-city-name="싱가포르"')
    expect(markup).toContain('data-campfit-program-card="true" data-program-id="prog-1" data-city-name="싱가포르"')
    expect(markup).toContain("싱가포르 STEM 캠프")
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

  it("shows a family total trip cost and keeps its breakdown inside details", () => {
    const markup = renderToStaticMarkup(
      createElement(CampFitV3Result, {
        result,
        basicInfo,
        conversationState,
        onBack: vi.fn(),
        onRestart: vi.fn(),
      })
    )

    expect(markup).toContain("우리 가족 예상 총여행비")
    expect(markup).toContain("800만~1,000만 원")
    expect(markup).toContain("일부 추정 포함")
    expect(markup).toContain("총여행비 구성")
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
    expect(markup).toContain("PNG 이미지 저장")
    expect(markup).toContain("PDF 저장하기")
    expect(markup).not.toContain("이메일로 받기 · 준비 중")
  })
})

function testLine(status: TripCostLine["status"], low: number | null, high: number | null): TripCostLine {
  return { low, high, status, selectedVariant: null, travelerCount: 2, includedItems: [], notes: [], sourceAmounts: [] }
}
