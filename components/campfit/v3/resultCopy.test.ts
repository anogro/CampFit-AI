import { describe, expect, it } from "vitest"
import { cityWhyBullets, programCautions, programRecommendationReasons, programStrengths } from "@/components/campfit/v3/resultCopy"
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
  reason: "프로그램의 STEM 프로젝트 구성이 아이의 관심사와 연결돼요.",
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
      program.reason,
      "아이 연령에 맞는 범위를 확인했어요.",
      "4주 옵션 선택지를 확인했어요.",
    ]))
  })

  it("uses stored candidate reasons and grounded highlights instead of a repeated direction fallback", () => {
    const candidate = {
      ...program,
      reason: "프로그램의 또래 협업 프로젝트가 아이가 원하는 교류 경험과 연결돼요.",
      matchHighlights: ["프로젝트 안에서 또래와 함께 결과물을 만들 수 있어요."],
      tradeoff: "영어 수업 방식과 초반 지원 범위 확인",
    }
    expect(programStrengths(candidate)).toEqual([
      candidate.reason,
      ...candidate.matchHighlights,
    ])
    expect(programCautions(candidate)).toContain(candidate.tradeoff)
    expect(programStrengths(candidate).join(" ")).not.toContain("주제·프로젝트를 중심으로 아이의 조건을 살펴볼 수 있어요.")
  })

  it("uses the next grounded highlight when candidate reasons are duplicated", () => {
    const first = { ...program, reason: "같은 후보 설명" }
    const second = { ...program, programId: "stem-program-2", reason: first.reason, matchHighlights: ["두 번째 후보의 STEM 활동 근거"] }
    expect(programRecommendationReasons([first, second])).toEqual([first.reason, second.matchHighlights[0]])
  })

  it("shows English caution only when the state requires a user-facing check", () => {
    const comfortable = programCautions({ ...program, englishMatchStatus: "comfortable" }).join(" ")
    const manageable = programCautions({ ...program, englishMatchStatus: "manageable_with_support" }).join(" ")
    const supported = programCautions({
      ...program,
      englishMatchStatus: "manageable_with_support",
      verify: ["영어 수업 방식과 초반 지원 범위 확인"],
    }).join(" ")
    const burden = programCautions({ ...program, englishMatchStatus: "english_burden_possible" }).join(" ")
    const unknown = programCautions({ ...program, englishMatchStatus: "unknown" }).join(" ")
    const mismatch = programCautions({
      ...program,
      englishMatchStatus: "official_requirement_mismatch",
      verify: ["공식 영어 자격조건과 아이의 현재 준비도 확인"],
    }).join(" ")

    expect(comfortable).not.toContain("영어")
    expect(manageable).not.toContain("영어 수업 방식")
    expect(supported).toContain("영어 수업 방식과 초반 지원 범위 확인")
    expect(burden).toContain("영어 부담이 있을 수 있어요")
    expect(unknown).toContain("프로그램 영어 요구 수준 확인 필요")
    expect(mismatch).not.toContain("영어")
  })
})
