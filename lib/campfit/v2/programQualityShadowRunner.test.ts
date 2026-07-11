import { describe, expect, it } from "vitest"
import { createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"
import { buildProgramShadowCalculationPlan } from "@/lib/campfit/v2/programQualityShadowRunner"
import type {
  ProgramEvidenceSourceCandidate,
  ProgramFactObservationCandidate,
  ProgramQualityScoreCandidate,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import type { ProgramQualityScore } from "@/types/campfitProgramQuality"

function evidence(id: string): ProgramEvidenceSourceCandidate {
  return {
    id,
    programId: "program-1",
    sourceType: "legacy_program_verification",
    sourceUrl: null,
    title: "Legacy program verification record",
    sourceDate: null,
    verificationStatus: "unverified",
    verifiedParticipation: false,
    isIndependent: false,
    metadata: {
      legacyVerificationId: id,
      legacyStatus: {},
      sourceSystem: "program_verifications",
      backfillVersion: "quality-phase1b-v1",
      mapperVersion: "legacy-mapper-v1",
      firstBackfillRunId: "run-1",
      riskLabelCount: 0,
      manualReviewCandidate: false,
    },
  }
}

function observation(id: string, evidenceSourceId: string): ProgramFactObservationCandidate {
  return {
    id,
    programId: "program-1",
    evidenceSourceId,
    providerClaimId: null,
    dimensionKey: "safety_emergency",
    factKey: "legacy_completeness.safety_verified",
    factValue: { value: "partial", scoringEligible: false, source: "legacy_completeness" },
    normalizedNumericValue: null,
    unit: null,
    observationStatus: "extracted",
    observationConfidence: 0,
    observedAt: null,
    validUntil: null,
    extractionMethod: "imported",
  }
}

function persistedSnapshot(candidate: ProgramQualityScoreCandidate, calculatedAt: string): ProgramQualityScore {
  const { overallQualityScore: _overallQualityScore, ...withoutNullableScore } = candidate
  return { ...withoutNullableScore, calculatedAt }
}

describe("buildProgramShadowCalculationPlan", () => {
  const scoringVersion = createShadowProgramQualityScoringVersion()
  const evidenceCandidates = [evidence("evidence-2"), evidence("evidence-1")]
  const observationCandidates = [
    observation("observation-2", "evidence-2"),
    observation("observation-1", "evidence-1"),
  ]

  it("builds a normal no-evidence shadow snapshot instead of a failed result", () => {
    const plan = buildProgramShadowCalculationPlan({
      programId: "program-1",
      scoringVersion,
      evidence: evidenceCandidates,
      observations: observationCandidates,
    })

    expect(plan).toMatchObject({
      programId: "program-1",
      scoringVersionId: scoringVersion.id,
      evidenceIds: ["evidence-1", "evidence-2"],
      observationIds: ["observation-1", "observation-2"],
      scoringEligibleFactCount: 0,
      dimensionInputs: [],
      evidenceConfidence: 0,
      dimensionCoverageCount: 0,
      independentSourceCount: 0,
      overallQualityScore: null,
      publicEligible: false,
      publicStatusLabel: "운영 정보 확인 중",
      calculationReason: "no_scoring_eligible_evidence",
      expectedDimensionScores: [],
      action: "create",
    })
    expect(plan.expectedSnapshot.calculationStatus).toBe("shadow")
    expect(plan.expectedSnapshot.calculationStatus).not.toBe("failed")
    expect(plan.expectedSnapshot.id).toBe(plan.snapshotId)
  })

  it("produces the same input hash and snapshot ID regardless of input array order", () => {
    const first = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion, evidence: evidenceCandidates, observations: observationCandidates,
    })
    const reordered = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion,
      evidence: [...evidenceCandidates].reverse(),
      observations: [...observationCandidates].reverse(),
    })

    expect(reordered.inputHash).toBe(first.inputHash)
    expect(reordered.snapshotId).toBe(first.snapshotId)
    expect(reordered.expectedSnapshot).toEqual(first.expectedSnapshot)
  })

  it("reuses an immutable-equivalent existing snapshot despite runtime timestamp changes", () => {
    const initial = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion, evidence: evidenceCandidates, observations: observationCandidates,
    })

    const firstTimestamp = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion, evidence: evidenceCandidates, observations: observationCandidates,
      existingSnapshot: persistedSnapshot(initial.expectedSnapshot, "2026-07-11T01:00:00.000Z"),
    })
    const secondTimestamp = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion, evidence: evidenceCandidates, observations: observationCandidates,
      existingSnapshot: persistedSnapshot(initial.expectedSnapshot, "2026-07-12T01:00:00.000Z"),
    })

    expect(firstTimestamp.action).toBe("reuse")
    expect(secondTimestamp.action).toBe("reuse")
    expect(secondTimestamp.inputHash).toBe(firstTimestamp.inputHash)
  })

  it("reports drift when the same deterministic snapshot ID has a different immutable payload", () => {
    const initial = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion, evidence: evidenceCandidates, observations: observationCandidates,
    })
    const existing = persistedSnapshot(initial.expectedSnapshot, "2026-07-11T01:00:00.000Z")
    const drifted: ProgramQualityScore = {
      ...existing,
      calculationSummary: { reason: "no_scoring_eligible_evidence", inputHash: "different-hash" },
    }

    const plan = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion, evidence: evidenceCandidates, observations: observationCandidates,
      existingSnapshot: drifted,
    })

    expect(plan.snapshotId).toBe(existing.id)
    expect(plan.action).toBe("drift")
  })

  it("creates a new identity when evidence or observation identity changes", () => {
    const initial = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion, evidence: evidenceCandidates, observations: observationCandidates,
    })
    const changedEvidence = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion,
      evidence: [evidence("evidence-3"), evidenceCandidates[1]!],
      observations: observationCandidates,
    })
    const changedObservation = buildProgramShadowCalculationPlan({
      programId: "program-1", scoringVersion,
      evidence: evidenceCandidates,
      observations: [observation("observation-3", "evidence-2"), observationCandidates[1]!],
    })

    expect(changedEvidence.inputHash).not.toBe(initial.inputHash)
    expect(changedEvidence.snapshotId).not.toBe(initial.snapshotId)
    expect(changedObservation.inputHash).not.toBe(initial.inputHash)
    expect(changedObservation.snapshotId).not.toBe(initial.snapshotId)
    expect(changedEvidence.action).toBe("create")
    expect(changedObservation.action).toBe("create")
  })

  it("fails closed if dimension rows exist for a no-evidence snapshot", () => {
    const plan = buildProgramShadowCalculationPlan({
      programId: "program-1",
      scoringVersion,
      evidence: evidenceCandidates,
      observations: observationCandidates,
      existingDimensionScores: [{
        dimensionKey: "safety_emergency",
        priorScore: 60,
        dimensionConfidence: 0,
        evidenceCount: 0,
        independentSourceCount: 0,
        dataGaps: [],
        explanation: {},
      }],
    })

    expect(plan.expectedDimensionScores).toEqual([])
    expect(plan.action).toBe("drift")
  })
})
