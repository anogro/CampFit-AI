import { describe, expect, it } from "vitest"
import {
  calculateDimensionCoverage,
  calculateEvidenceConfidence,
  confidenceLabelForScore,
} from "@/lib/campfit/v2/programEvidenceConfidence"
import { createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"
import type { EvidenceSourceType, ProgramEvidenceSource, ProgramQualityDimensionKey } from "@/types/campfitProgramQuality"

const now = "2026-07-11T00:00:00.000Z"

describe("calculateEvidenceConfidence", () => {
  it("returns zero when no evidence exists", () => {
    const result = calculateEvidenceConfidence({
      sources: [],
      coveredDimensions: [],
      agreementScore: 0,
      now,
      scoringVersion: createShadowProgramQualityScoringVersion(),
    })

    expect(result.score).toBe(0)
    expect(result.label).toBe("very_low")
  })

  it("caps provider-only sources at thirty", () => {
    const result = calculateEvidenceConfidence({
      sources: [
        source({ id: "provider-document", sourceType: "provider_official_document" }),
        source({ id: "provider-claim", sourceType: "provider_claim" }),
      ],
      coveredDimensions: ["care_emotional_support", "staff_management", "safety_emergency", "parent_communication", "english_environment", "beginner_support"],
      agreementScore: 100,
      now,
      scoringVersion: createShadowProgramQualityScoringVersion(),
    })

    expect(result.score).toBeLessThanOrEqual(30)
    expect(result.independentSourceCount).toBe(0)
  })

  it("rewards diverse independent recent sources", () => {
    const result = calculateEvidenceConfidence({
      sources: [
        source({ id: "audit", sourceType: "manual_audit", isIndependent: true }),
        source({ id: "official", sourceType: "public_official_page", isIndependent: true }),
        source({ id: "parent", sourceType: "verified_parent_review", isIndependent: true, verifiedParticipation: true }),
      ],
      coveredDimensions: ["care_emotional_support", "staff_management", "safety_emergency", "parent_communication", "english_environment", "beginner_support", "teaching_quality"],
      agreementScore: 85,
      now,
      scoringVersion: createShadowProgramQualityScoringVersion(),
    })

    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.independentSourceCount).toBe(3)
  })

  it("deduplicates identical canonical URLs and content hashes", () => {
    const input: { readonly coveredDimensions: readonly ProgramQualityDimensionKey[]; readonly agreementScore: number; readonly now: string; readonly scoringVersion: ReturnType<typeof createShadowProgramQualityScoringVersion> } = {
      coveredDimensions: ["care_emotional_support", "staff_management", "safety_emergency", "parent_communication", "english_environment", "beginner_support"],
      agreementScore: 80,
      now,
      scoringVersion: createShadowProgramQualityScoringVersion(),
    }
    const single = calculateEvidenceConfidence({
      ...input,
      sources: [source({ id: "single", sourceType: "manual_audit", isIndependent: true, canonicalUrl: "https://example.com/a", contentHash: "same" })],
    })
    const duplicate = calculateEvidenceConfidence({
      ...input,
      sources: [
        source({ id: "first", sourceType: "manual_audit", isIndependent: true, canonicalUrl: "https://example.com/a", contentHash: "same" }),
        source({ id: "second", sourceType: "manual_audit", isIndependent: true, canonicalUrl: "https://example.com/a", contentHash: "same" }),
      ],
    })

    expect(duplicate.effectiveSourceCount).toBe(1)
    expect(duplicate.score).toBe(single.score)
  })

  it("deduplicates sources when either a canonical URL or content hash matches", () => {
    const result = calculateEvidenceConfidence({
      sources: [
        source({ id: "url-and-hash", sourceType: "manual_audit", isIndependent: true, canonicalUrl: "https://example.com/a", contentHash: "same" }),
        source({ id: "hash-only", sourceType: "manual_audit", isIndependent: true, canonicalUrl: "https://example.com/b", contentHash: "same" }),
      ],
      coveredDimensions: ["care_emotional_support", "staff_management", "safety_emergency", "parent_communication", "english_environment", "beginner_support"],
      agreementScore: 80,
      now,
      scoringVersion: createShadowProgramQualityScoringVersion(),
    })

    expect(result.effectiveSourceCount).toBe(1)
  })

  it("reduces recency for older evidence and coverage for fewer dimensions", () => {
    const version = createShadowProgramQualityScoringVersion()
    const recent = calculateEvidenceConfidence({
      sources: [source({ id: "recent", sourceType: "manual_audit", isIndependent: true, sourceDate: "2026-06-30T00:00:00.000Z" })],
      coveredDimensions: ["care_emotional_support", "staff_management", "safety_emergency", "parent_communication", "english_environment", "beginner_support"],
      agreementScore: 70,
      now,
      scoringVersion: version,
    })
    const oldAndSparse = calculateEvidenceConfidence({
      sources: [source({ id: "old", sourceType: "manual_audit", isIndependent: true, sourceDate: "2023-01-01T00:00:00.000Z" })],
      coveredDimensions: ["care_emotional_support"],
      agreementScore: 70,
      now,
      scoringVersion: version,
    })

    expect(recent.score).toBeGreaterThan(oldAndSparse.score)
    expect(calculateDimensionCoverage(["care_emotional_support"])).toBe(10)
  })
})

describe("confidenceLabelForScore", () => {
  it("maps fixed score bands", () => {
    expect(confidenceLabelForScore(24)).toBe("very_low")
    expect(confidenceLabelForScore(25)).toBe("low")
    expect(confidenceLabelForScore(50)).toBe("medium")
    expect(confidenceLabelForScore(70)).toBe("high")
    expect(confidenceLabelForScore(85)).toBe("very_high")
  })
})

function source(overrides: {
  readonly id: string
  readonly sourceType: EvidenceSourceType
  readonly isIndependent?: boolean
  readonly verifiedParticipation?: boolean
  readonly canonicalUrl?: string
  readonly contentHash?: string
  readonly sourceDate?: string
}): ProgramEvidenceSource {
  return {
    id: overrides.id,
    programId: "program-1",
    sourceType: overrides.sourceType,
    verificationStatus: "verified",
    verifiedParticipation: overrides.verifiedParticipation ?? false,
    isIndependent: overrides.isIndependent ?? false,
    collectedAt: now,
    metadata: {},
    ...(overrides.canonicalUrl === undefined ? {} : { canonicalUrl: overrides.canonicalUrl }),
    ...(overrides.contentHash === undefined ? {} : { contentHash: overrides.contentHash }),
    ...(overrides.sourceDate === undefined ? {} : { sourceDate: overrides.sourceDate }),
  }
}
