import { describe, expect, it } from "vitest"
import { camps } from "@/data/campfit/camps"
import { buildCampfitV2ConsultingProfile } from "@/lib/campfit/v2/profileBuilder"
import { buildCampfitV2Report } from "@/lib/campfit/v2/reportBuilder"
import { recommendCampsV2, type CampfitV2MatchingResult, type RecommendationCardV2WithScore } from "@/lib/campfit/v2/v2MatchingWrapper"
import type { AIExtractionResult, ExcludedCandidateV2, RequiredIntake } from "@/types/campfitV2"

const requiredIntake: RequiredIntake = {
  childAgeAtStart: 10,
  departureWindow: "summer_break",
  durationWeeksMin: 2,
  durationWeeksMax: 4,
  totalBudgetAllInKrwMin: 5_000_000,
  totalBudgetAllInKrwMax: 8_000_000,
  budgetScope: "family_total",
  travelerCounts: { child: 1, parent: 1, sibling: 0 },
  preferredRegionGroups: ["oceania"],
  regionPriority: "strong",
  parentAccompanimentMode: "parent_can_stay",
  koreanSupportNeed: "daily_korean_communication",
  accommodationPreferences: ["parent_stay"],
}

const extraction: AIExtractionResult = {
  understandingSummaryForUser: "상담 요약",
  extractedProfile: {
    detectedRegions: ["oceania"],
    detectedProgramTypes: ["international_school_regular"],
    parentGoals: ["natural_english_exposure", "cultural_exposure"],
    childSignals: [],
    riskSignals: ["english_overload", "separation_risk"],
    avoidSignals: [],
    flexibilitySignals: [],
  },
  missingSlots: [],
  conflicts: [],
  confidenceMap: {},
  recommendedQuestionKeys: [],
}

describe("buildCampfitV2Report", () => {
  it("Given no exact recommendations When building report Then option groups and closest candidates are still returned", () => {
    const profile = buildProfile()
    const report = buildCampfitV2Report(profile, {
      recommendations: [],
      relaxedCandidates: [sampleCard],
      excludedCandidates: [sampleExcludedCandidate],
      strategySummary: {},
    })

    expect(report.conclusion.length).toBeGreaterThan(20)
    expect(report.conclusion).not.toContain("가능한 후보가 없습니다")
    expect(report.optionGroups.length).toBe(3)
    expect(report.recommendations).toHaveLength(1)
    expect(report.recommendations[0]?.programName).toBe("조건부 검토 후보")
  })

  it("Given excluded candidates When building report Then excluded summary groups are generated", () => {
    const profile = buildProfile()
    const report = buildCampfitV2Report(profile, {
      recommendations: [],
      relaxedCandidates: [sampleCard],
      excludedCandidates: [sampleExcludedCandidate],
      strategySummary: {},
    })

    expect(report.excludedSummaryGroups.some((group) => group.label.includes("예산"))).toBe(true)
    expect(report.excludedSummaryGroups.some((group) => group.label.includes("기간"))).toBe(true)
  })

  it("Given matching result When building report Then fit score axes are generated", () => {
    const profile = buildProfile()
    const matching = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.country === "Australia") })
    const report = buildCampfitV2Report(profile, matching)

    expect(report.fitScoreSummary.axes).toHaveLength(7)
    expect(report.optionGroups.length).toBe(3)
    expect(JSON.stringify(report)).not.toMatch(/\bgrade\b/i)
    expect(JSON.stringify(report)).not.toMatch(/\bbudgetIncludesFlight\b/)
  })
})

const sampleCard: RecommendationCardV2WithScore = {
  programId: "conditional-candidate",
  programName: "조건부 검토 후보",
  tier: "possible_if_adjusted",
  fitScoreSummary: {
    overallScore: 64,
    tier: "possible_if_adjusted",
    label: "조건을 조정하면 검토 가능",
    axes: [
      { key: "child_fit", label: "아이 적응 적합도", score: 65, comment: "초반 적응 확인이 필요합니다." },
      { key: "english_readiness", label: "영어 준비도 적합도", score: 60, comment: "영어 부담 확인이 필요합니다." },
      { key: "family_constraints", label: "부모 조건 적합도", score: 70, comment: "부모 조건과 일부 맞습니다." },
      { key: "support_fit", label: "지원장치 적합도", score: 68, comment: "지원 범위를 확인해야 합니다." },
      { key: "growth_balance", label: "성장 자극 적합도", score: 66, comment: "문화 경험을 기대할 수 있습니다." },
      { key: "budget_reality", label: "비용 현실성", score: 58, comment: "비용 확인이 필요합니다." },
      { key: "risk_management", label: "리스크 관리", score: 62, comment: "리스크 관리를 확인해야 합니다." },
    ],
  },
  fitSummary: "조건부로 검토할 수 있는 후보입니다.",
  matchedConditions: ["부모 동행 조건과 일부 맞습니다."],
  mismatchedConditions: ["선호 지역과 다릅니다."],
  recommendDespiteMismatchReason: "아이 적응 기준에는 볼 만한 후보입니다.",
  childFit: "아이 적응 확인이 필요합니다.",
  familyFit: "부모 조건과 일부 맞습니다.",
  riskLevel: "medium",
  riskReasons: ["비용 확인이 필요합니다."],
  mitigation: ["초급 지원을 확인하세요."],
  consultingChecklist: ["실제 포함 비용을 확인하세요."],
  scoreBreakdown: { legacyScore: 50, v2Score: 64 },
}

const sampleExcludedCandidate: ExcludedCandidateV2 = {
  programId: "excluded-candidate",
  programName: "제외 후보",
  excludedReasons: ["항공권 포함 총예산에서 예상 부대비를 제외하면 프로그램비가 부족할 가능성이 높습니다.", "희망 기간보다 최소 운영 기간이 깁니다."],
  conditionRelaxation: ["예산 범위를 올리면 재검토 가능합니다.", "기간을 3주 이상으로 늘리면 검토 가능합니다."],
  stillWorthConsideringReason: "조건 조정 시 재검토할 수 있습니다.",
}

function buildProfile() {
  return buildCampfitV2ConsultingProfile({
    requiredIntake,
    naturalInput: { situationText: "오세아니아 스쿨링이 좋아 보이지만 영어 초급과 분리가 걱정됩니다." },
    extraction,
    budgetEstimates: [
      {
        regionGroup: "oceania",
        flags: ["unknown_cost_assumption", "needs_consultation_check"],
        note: "상담 전 확인 필요",
      },
    ],
  })
}
