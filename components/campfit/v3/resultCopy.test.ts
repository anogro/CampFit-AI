import { describe, expect, it } from "vitest"
import { cityWhyBullets, programCautions, programStrengths } from "@/components/campfit/v3/resultCopy"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3DestinationRecommendation,
  CampfitV3ProgramCandidate,
  CampfitV3RecommendationResult,
} from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [7],
  departureWindow: "2026년 8월",
  durationWeeks: 4,
  budgetMinKrw: 8_000_000,
  budgetMaxKrw: 12_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const state = {
  facts: {
    parentStayGoals: { value: ["restWellness"] },
  },
} as unknown as CampfitV3ConversationState

const result = {
  experienceDirections: [{ label: "주제·프로젝트 경험" }],
} as unknown as CampfitV3RecommendationResult

const city: CampfitV3DestinationRecommendation = {
  cityId: "cebu",
  cityName: "Cebu",
  countryName: "Philippines",
  role: "가장 균형 잡힌 선택",
  imageUrl: null,
  reason: "technical reason",
  verify: ["프로그램과 숙소 사이 실제 이동시간", "항공료의 왕복·출발지·시즌 기준"],
  costEstimate: {
    label: "비교용 추정",
    estimatedTotalMinKrw: 8_000_000,
    estimatedTotalMaxKrw: 11_000_000,
    confidence: "medium",
    includedComponents: ["프로그램비", "항공비 참고값"],
    missingComponents: ["현지 교통비", "보험·비자"],
  },
}

const program: CampfitV3ProgramCandidate = {
  programId: "stem-program",
  name: "STEM Camp",
  cityName: "Cebu",
  countryName: "Philippines",
  imageUrl: null,
  ageLabel: "만 7~12세",
  durationLabel: "4주 옵션",
  priceLabel: "1,000만원",
  primaryDirection: "주제·프로젝트 경험",
  reason: "실제 DB 후보",
  verify: ["핵심 경험 방향(주제·프로젝트 경험)의 구조화 근거 미확인"],
  detailUrl: null,
  group: "우선 살펴볼 프로그램",
  score: 80,
}

describe("CampFit v3 result copy", () => {
  it("puts parent-readable reasons before cost and catalog details", () => {
    const bullets = cityWhyBullets(city, basicInfo, state, result)
    expect(bullets).toContain("4주 가족 체류를 기준으로 비교했어요.")
    expect(bullets).toContain("입력한 전체 예산 안에서 비교 가능한 구간이 있어요.")
    expect(bullets.join(" ")).not.toContain("프로그램 개수")
    expect(bullets.join(" ")).not.toContain("조건을 통과")
  })

  it("keeps confirmation copy short and separates program strengths from cautions", () => {
    expect(programCautions(program)).toEqual(["원하는 경험 방향과 실제 활동의 차이"])
    expect(programStrengths(program)).toEqual(expect.arrayContaining([
      "주제·프로젝트를 중심으로 아이의 조건을 살펴볼 수 있어요.",
      "아이 연령에 맞는 범위를 확인했어요.",
      "4주 옵션 선택지를 확인했어요.",
    ]))
  })
})
