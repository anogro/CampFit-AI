import { describe, expect, it } from "vitest"
import { buildProgramQualityPublicSummary } from "@/lib/campfit/v2/programQualityPublicMapper"
import { calculateProgramQuality, createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"
import type { ProgramCriticalRiskFlag } from "@/types/campfitProgramQuality"

describe("buildProgramQualityPublicSummary", () => {
  it("does not expose internal risk or evidence details", () => {
    const result = calculateProgramQuality({
      programId: "program-1",
      scoringVersion: createShadowProgramQualityScoringVersion(),
      evidenceSources: [],
      dimensions: [],
      criticalRisks: [activeCriticalRisk()],
      agreementScore: 0,
      calculatedAt: "2026-07-11T00:00:00.000Z",
    })

    const summary = buildProgramQualityPublicSummary(result)

    expect(JSON.stringify(summary)).not.toContain("do not expose")
    expect(JSON.stringify(summary)).not.toContain("risk-1")
    expect(summary.publicStatus).toBe("추천 보류 · 추가 확인 필요")
    expect(summary.isScoreVisible).toBe(false)
  })
})

function activeCriticalRisk(): ProgramCriticalRiskFlag {
  return { id: "risk-1", programId: "program-1", severity: "critical", status: "under_review", internalSummary: "do not expose", publicSummary: "관리자 확인 중", detectedAt: "2026-07-10T00:00:00.000Z", metadata: {} }
}
