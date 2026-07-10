import { describe, expect, it } from "vitest"
import {
  calculateAdjustedDimensionScore,
  calculateProgramQuality,
  createShadowProgramQualityScoringVersion,
} from "@/lib/campfit/v2/programQualityScorer"
import type {
  ProgramCriticalRiskFlag,
  ProgramEvidenceSource,
  ProgramQualityDimensionInput,
  ProgramQualityDimensionKey,
} from "@/types/campfitProgramQuality"

const version = createShadowProgramQualityScoringVersion()

describe("calculateAdjustedDimensionScore", () => {
  it("returns null without an observed score", () => {
    expect(calculateAdjustedDimensionScore({ priorScore: 60, dimensionConfidence: 50 })).toBeNull()
  })

  it("uses confidence as a zero-to-one shrinkage factor", () => {
    expect(calculateAdjustedDimensionScore({ priorScore: 60, observedScore: 80, dimensionConfidence: 50 })).toBe(70)
  })

  it("caps provider-only positive movement but keeps verified negative movement", () => {
    expect(calculateAdjustedDimensionScore({
      priorScore: 60,
      observedScore: 100,
      dimensionConfidence: 100,
      providerOnlyPositiveEvidence: true,
    })).toBe(65)
    expect(calculateAdjustedDimensionScore({
      priorScore: 60,
      observedScore: 20,
      dimensionConfidence: 100,
      providerOnlyPositiveEvidence: true,
    })).toBe(20)
  })
})

describe("calculateProgramQuality", () => {
  it("renormalizes only scored dimensions and hides low coverage", () => {
    const result = calculateProgramQuality({
      programId: "program-1",
      scoringVersion: version,
      evidenceSources: independentSources(),
      dimensions: [dimension("care_emotional_support", 80), dimension("safety_emergency", 70)],
      criticalRisks: [],
      agreementScore: 90,
      calculatedAt: "2026-07-11T00:00:00.000Z",
    })

    expect(result.overallQualityScore).not.toBeNull()
    expect(result.dimensionCoverageCount).toBe(2)
    expect(result.publicEligibility.isEligible).toBe(false)
  })

  it("shows a reference label for medium confidence and sufficient coverage", () => {
    const result = calculateProgramQuality({
      programId: "program-1",
      scoringVersion: version,
      evidenceSources: independentSources(),
      dimensions: sixDimensions(),
      criticalRisks: [],
      agreementScore: 90,
      calculatedAt: "2026-07-11T00:00:00.000Z",
    })

    expect(result.evidenceConfidence).toBeGreaterThanOrEqual(50)
    expect(result.publicEligibility.isEligible).toBe(true)
    expect(result.publicEligibility.statusLabel).toBe("근거 보통 · 참고용")
  })

  it("withholds numeric quality for active high or critical risk", () => {
    const result = calculateProgramQuality({
      programId: "program-1",
      scoringVersion: version,
      evidenceSources: independentSources(),
      dimensions: sixDimensions(),
      criticalRisks: [activeHighRisk()],
      agreementScore: 90,
      calculatedAt: "2026-07-11T00:00:00.000Z",
    })

    expect(result.publicEligibility.isEligible).toBe(false)
    expect(result.publicEligibility.statusLabel).toBe("추천 보류 · 추가 확인 필요")
  })
})

function dimension(dimensionKey: ProgramQualityDimensionKey, observedScore: number): ProgramQualityDimensionInput {
  return { dimensionKey, priorScore: 60, observedScore }
}

function sixDimensions(): readonly ProgramQualityDimensionInput[] {
  return [
    dimension("care_emotional_support", 80),
    dimension("staff_management", 75),
    dimension("safety_emergency", 85),
    dimension("parent_communication", 80),
    dimension("english_environment", 70),
    dimension("beginner_support", 75),
  ]
}

function independentSources(): readonly ProgramEvidenceSource[] {
  return [
    { id: "audit", programId: "program-1", sourceType: "manual_audit", verificationStatus: "verified", verifiedParticipation: false, isIndependent: true, collectedAt: "2026-07-01T00:00:00.000Z", metadata: {} },
    { id: "official", programId: "program-1", sourceType: "public_official_page", verificationStatus: "verified", verifiedParticipation: false, isIndependent: true, collectedAt: "2026-07-02T00:00:00.000Z", metadata: {} },
  ]
}

function activeHighRisk(): ProgramCriticalRiskFlag {
  return { id: "risk-1", programId: "program-1", severity: "high", status: "under_review", internalSummary: "internal", publicSummary: "관리자 확인 중", detectedAt: "2026-07-10T00:00:00.000Z", metadata: {} }
}
