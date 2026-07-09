import { describe, expect, it } from "vitest"
import { buildAIUnderstandingDisplaySections, sentenceForSignal } from "@/lib/campfit/v2/aiUnderstandingDisplay"
import type { AIExtractionResult } from "@/types/campfitV2"

describe("AI understanding display mapper", () => {
  it("Given raw extraction keys When building sections Then user-facing Korean sentences are returned", () => {
    const result: AIExtractionResult = {
      understandingSummaryForUser: "summary",
      extractedProfile: {
        detectedRegions: ["oceania"],
        detectedProgramTypes: ["schooling", "international_school_experience"],
        parentGoals: ["natural_english_exposure"],
        childSignals: ["slow_to_adapt", "socially_reserved"],
        riskSignals: ["english_proficiency_concern"],
        avoidSignals: ["too_study_focused"],
      },
      missingSlots: [{ slotKey: "unused", reason: "raw missing info", importance: "medium" }],
      conflicts: [{ conflictKey: "conflict_schooling_low_english", description: "raw", severity: "medium" }],
      confidenceMap: {},
      recommendedQuestionKeys: ["english_help_seeking"],
    }

    const sections = buildAIUnderstandingDisplaySections(result)
    const serialized = JSON.stringify(sections)

    expect(sections.parentDirection).toContain("호주·뉴질랜드 등 오세아니아 지역에 관심이 있습니다.")
    expect(sections.parentDirection).toContain("스쿨링 또는 현지 학교 수업 체험을 선호합니다.")
    expect(sections.childConsiderations).toContain("낯선 환경에 적응하는 데 시간이 걸리는 편입니다.")
    expect(sections.cautionPoints).toContain("너무 공부 위주의 프로그램은 피하고 싶은 조건입니다.")
    expect(serialized).not.toContain("oceania")
    expect(serialized).not.toContain("schooling")
    expect(serialized).not.toContain("slow_to_adapt")
    expect(serialized).not.toContain("socially_reserved")
  })

  it("Given unknown raw signals When building sections Then generic repeated child-trait fallback is not shown", () => {
    const result: AIExtractionResult = {
      understandingSummaryForUser: "summary",
      extractedProfile: {
        detectedRegions: ["unknown_region_key"],
        detectedProgramTypes: [],
        parentGoals: [],
        childSignals: ["unmapped_child_key"],
        riskSignals: [],
        avoidSignals: [],
      },
      missingSlots: [],
      conflicts: [],
      confidenceMap: {},
      recommendedQuestionKeys: [],
    }

    const sections = buildAIUnderstandingDisplaySections(result)
    const serialized = JSON.stringify(sections)

    expect(serialized).not.toContain("unknown_region_key")
    expect(serialized).not.toContain("unmapped_child_key")
    expect(serialized).not.toContain("추가로 확인할 아이 성향")
  })

  it("Given known raw key When mapping signal Then natural Korean sentence is returned", () => {
    expect(sentenceForSignal("english_proficiency_concern")).toBe("영어 초급으로 인해 수업 참여나 또래 관계에서 위축될 가능성을 걱정하고 있습니다.")
    expect(sentenceForSignal("slow adaptation")).toBe("낯선 환경에 적응하는 데 시간이 걸리는 편입니다.")
  })
})
