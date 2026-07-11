import { describe, expect, it } from "vitest"
import {
  QUALITY_FACT_SIGNAL_RULES_V1,
  aggregateDimensionSignals,
  isScoringEligibleObservation,
} from "@/lib/campfit/v2/programQualityFactAggregator"
import { mapLegacyProgramVerification } from "@/lib/campfit/v2/programVerificationFactMapper"
import type { ScoringObservationCandidate } from "@/lib/campfit/v2/programQualityFactAggregator"
import type { FactObservationStatus } from "@/types/campfitProgramQuality"

const baseObservation: ScoringObservationCandidate = {
  evidenceSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  dimensionKey: "safety_emergency",
  factKey: "quality.safety.emergency_preparedness",
  factValue: { scoringEligible: true },
  normalizedNumericValue: 80,
  observationStatus: "verified",
  observationConfidence: 1,
}

describe("program quality fact aggregator", () => {
  it("Given the Phase 1B-1 registry When aggregating Then the allowlist and output are empty", () => {
    expect(QUALITY_FACT_SIGNAL_RULES_V1).toEqual({})
    expect(isScoringEligibleObservation(baseObservation)).toBe(false)
    expect(aggregateDimensionSignals([baseObservation])).toEqual([])
  })

  it("Given legacy completeness metadata When checking eligibility Then the namespace is always rejected", () => {
    expect(isScoringEligibleObservation({
      ...baseObservation,
      factKey: "legacy_completeness.safety_verified",
    })).toBe(false)
  })

  it("Given unsafe scoring fields When checking eligibility Then each safety gate rejects the observation", () => {
    expect(isScoringEligibleObservation({ ...baseObservation, factValue: { scoringEligible: false } })).toBe(false)
    expect(isScoringEligibleObservation({ ...baseObservation, normalizedNumericValue: null })).toBe(false)
    expect(isScoringEligibleObservation({ ...baseObservation, normalizedNumericValue: undefined })).toBe(false)
    expect(isScoringEligibleObservation({ ...baseObservation, observationConfidence: 0 })).toBe(false)
    expect(isScoringEligibleObservation({ ...baseObservation, dimensionKey: "living_support", normalizedNumericValue: 95 })).toBe(false)
  })

  it("Given disputed, rejected, or expired observations When checking eligibility Then all are rejected", () => {
    for (const observationStatus of ["disputed", "rejected", "expired"] satisfies readonly FactObservationStatus[]) {
      expect(isScoringEligibleObservation({ ...baseObservation, observationStatus })).toBe(false)
    }
  })

  it("Given seven legacy rows When aggregating 42 metadata observations Then coverage remains empty", () => {
    const observations = Array.from({ length: 7 }, (_, index) => mapLegacyProgramVerification({
      verification: {
        id: `legacy-verification-${index}`,
        program_id: "11111111-1111-4111-8111-111111111111",
        operator_verified: "complete",
        facility_verified: "partial",
        curriculum_verified: "partial",
        refund_verified: "missing",
        safety_verified: "partial",
        accommodation_verified: "partial",
        risk_labels: [],
        notes: [],
        summary: "ignored",
        verified_at: "2026-07-09T00:00:00.000Z",
        created_at: "2026-06-23T00:00:00.000Z",
      },
      program: { id: "11111111-1111-4111-8111-111111111111" },
      backfillRunId: "run-001",
    }).metadataObservations).flat()

    expect(observations).toHaveLength(42)
    expect(aggregateDimensionSignals(observations)).toEqual([])
  })
})
