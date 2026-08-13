import { describe, expect, it } from "vitest"
import { cityWhyBullets, programCautions, programStrengths } from "@/components/campfit/v3/resultCopy"
import { englishMatchLabels } from "@/lib/campfit/v3/englishRequirement"
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
    label: "체류 비용 참고",
    estimatedTotalMinKrw: 8_000_000,
    estimatedTotalMaxKrw: 11_000_000,
    confidence: "medium",
    includedComponents: ["프로그램비", "항공비 참고값"],
    missingComponents: ["현지 교통비", "보험·비자"],
  },
  livingCostMonthlyKrw: 1_800_000,
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
    expect(bullets).toContain("도시 평균 생활비와 부모 체류 조건을 함께 살펴봤어요.")
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

  it("puts an English burden in the caution list instead of labeling it as demo data", () => {
    const candidate = {
      ...program,
      englishMatchStatus: "english_burden_possible" as const,
      englishMatchLabel: englishMatchLabels.english_burden_possible,
    }
    expect(programCautions(candidate)[0]).toBe(englishMatchLabels.english_burden_possible)
  })

  it("renders stored personalized match evidence before eligibility fallbacks", () => {
    const candidate = {
      ...program,
      reason: "외국 친구들과 어울리는 경험을 가장 중요하게 보셔서 프로그램의 또래 교류·협업 활동 정보와 잘 맞는 후보예요.",
      matchHighlights: ["아이가 좋아하는 몸을 움직이는 활동과 프로그램의 스포츠 구성이 연결돼요."],
      tradeoff: "영어 초급자 지원 여부는 확인이 필요해요.",
    }
    expect(programStrengths(candidate)).toEqual([
      candidate.reason,
      "아이가 좋아하는 몸을 움직이는 활동과 프로그램의 스포츠 구성이 연결돼요.",
    ])
    expect(programCautions(candidate)).toContain("영어 초급자 지원 여부는 확인이 필요해요.")
  })
})
