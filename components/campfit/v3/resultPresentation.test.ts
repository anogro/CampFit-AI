import { describe, expect, it } from "vitest"
import {
  buildAnogroCityHref,
  buildDecisionAxes,
  decisionAxesSummary,
  programCatalogPresentation,
  safeProgramDetailHref,
} from "@/components/campfit/v3/resultPresentation"
import type { CampfitV3BasicInfo, CampfitV3ConversationState, CampfitV3RecommendationResult } from "@/types/campfitV3"

describe("CampFit v3 result presentation", () => {
  it("builds six qualitative decision axes without exposing score labels", () => {
    const axes = buildDecisionAxes(result, state, basicInfo)

    expect(axes).toHaveLength(6)
    expect(axes.map((axis) => axis.label)).toEqual([
      "영어 경험",
      "학교·학습",
      "주제·프로젝트",
      "문화·활동",
      "지원 필요",
      "가족 체류 현실성",
    ])
    expect(axes.find((axis) => axis.key === "culture")?.level).toBe("high")
    expect(axes.find((axis) => axis.key === "english")?.level).toBe("medium")
    expect(axes.find((axis) => axis.key === "school")?.level).toBe("low")
    expect(axes.find((axis) => axis.key === "support")?.level).toBe("medium")
    expect(axes.find((axis) => axis.key === "family")?.level).toBe("high")
    expect(axes.every((axis) => ["low", "medium", "high"].includes(axis.level))).toBe(true)
    expect(decisionAxesSummary(axes)).not.toMatch(/\d+점/)
  })

  it("uses the verified ANOGRO city route and rejects unsafe program URLs", () => {
    expect(buildAnogroCityHref("Cebu", "https://www.anogro.com")).toBe("https://www.anogro.com/city/Cebu")
    expect(buildAnogroCityHref("Chiang Mai", "https://www.anogro.com")).toBe("https://www.anogro.com/city/Chiang%20Mai")
    expect(buildAnogroCityHref(" Cebu ", " https://www.anogro.com/ ")).toBe("https://www.anogro.com/city/Cebu")
    expect(buildAnogroCityHref("", "https://www.anogro.com")).toBeNull()
    expect(buildAnogroCityHref("세부", "https://www.anogro.com/")).toBe("https://www.anogro.com/city/%EC%84%B8%EB%B6%80")
    expect(buildAnogroCityHref("Cebu", undefined)).toBe("https://www.anogro.com/city/Cebu")
    expect(buildAnogroCityHref("Cebu", "")).toBeNull()
    expect(buildAnogroCityHref("Cebu", "javascript:alert(1)")).toBeNull()
    expect(safeProgramDetailHref("https://www.anogro.com/program/camp-slug")).toBe("https://www.anogro.com/program/camp-slug")
    expect(safeProgramDetailHref("javascript:alert(1)")).toBeNull()
    expect(safeProgramDetailHref(null)).toBeNull()
  })

  it("distinguishes verified and unavailable catalog sources", () => {
    const verified = programCatalogPresentation("supabase")
    const unavailable = programCatalogPresentation("unavailable")

    expect(verified.showProgramCards).toBe(true)
    expect(verified.notice).toBeNull()
    expect(verified.sectionSubtitle).toContain("실제 프로그램 DB")
    expect(unavailable.showProgramCards).toBe(false)
    expect(unavailable.unavailableTitle).toBe("프로그램 정보를 불러오지 못했습니다")
    expect(unavailable.unavailableGuidance).toContain("다시")
  })
})

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "다음 여름방학",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 8_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const state: CampfitV3ConversationState = {
  facts: {
    childEnglishLevel: fact("childEnglishLevel", "beginner"),
    specialCareFollowUp: fact("specialCareFollowUp", "none"),
    koreanSupportNeed: fact("koreanSupportNeed", "emergency_only"),
    parentStayGoals: fact("parentStayGoals", ["restWellness"]),
  },
  askedQuestionKeys: [],
  completedQuestionKeys: [],
  failedQuestionKeys: [],
  currentQuestionKey: null,
  questionCount: 8,
  progress: 100,
  unresolved: [],
  conflicts: [],
}

const result: CampfitV3RecommendationResult = {
  consultingConclusion: "문화·활동 경험을 중심으로 살펴보세요.",
  experienceDirections: [
    { key: "cultureActivity", label: "문화·활동 경험", fitLabel: "가장 잘 맞는 방향", score: 98, explanation: "설명" },
    { key: "englishIntensive", label: "영어 집중 경험", fitLabel: "함께 검토할 방향", score: 67, explanation: "설명" },
    { key: "schoolSchooling", label: "학교·스쿨링 경험", fitLabel: "조건을 조정하면 가능", score: 48, explanation: "설명" },
    { key: "subjectProject", label: "주제·프로젝트 경험", fitLabel: "현재 우선순위가 낮음", score: 35, explanation: "설명" },
  ],
  destinationRecommendations: [],
  requiredSupportConditions: [],
  programCandidates: [],
  verificationChecklist: [],
  alternatives: [],
  limitedResult: false,
  catalogSource: "supabase",
}

function fact(key: keyof CampfitV3ConversationState["facts"], value: unknown) {
  return { key, subject: "constraint" as const, value, source: "quick_reply" as const, confidence: 1, evidence: "테스트", updatedAt: "2026-07-13T00:00:00.000Z" }
}
