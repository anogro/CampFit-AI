import { describe, expect, it } from "vitest"
import {
  ProgramCriticalRiskFlagSchema,
  ProgramFactObservationSchema,
  ProgramQualityPublicSummarySchema,
  ProgramQualityScoringVersionSchema,
} from "@/lib/campfit/v2/programQualitySchemas"
import { createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"

describe("program quality schemas", () => {
  it("rejects an invalid dimension key and out-of-range score", () => {
    expect(ProgramFactObservationSchema.safeParse({
      id: "fact-1",
      programId: "program-1",
      evidenceSourceId: "source-1",
      dimensionKey: "invalid",
      factKey: "staff_ratio",
      factValue: 8,
      observationStatus: "verified",
      observationConfidence: 1.2,
      extractionMethod: "manual",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
    }).success).toBe(false)
  })

  it("rejects an invalid critical-risk status", () => {
    expect(ProgramCriticalRiskFlagSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000001",
      programId: "00000000-0000-0000-0000-000000000002",
      severity: "high",
      status: "open",
      internalSummary: "internal",
      detectedAt: "2026-07-11T00:00:00.000Z",
      metadata: {},
    }).success).toBe(false)
  })

  it("rejects internal fields in public summaries", () => {
    expect(ProgramQualityPublicSummarySchema.safeParse({
      confidenceScore: 20,
      confidenceLabel: "low",
      publicStatus: "운영 정보 확인 중",
      verifiedDimensions: [],
      dataGaps: [],
      isScoreVisible: false,
      internalSummary: "must not cross boundary",
    }).success).toBe(false)
  })

  it("requires weights for every quality dimension", () => {
    const version = createShadowProgramQualityScoringVersion()

    expect(ProgramQualityScoringVersionSchema.safeParse({
      ...version,
      dimensionWeights: { care_emotional_support: 0.12 },
    }).success).toBe(false)
  })
})
