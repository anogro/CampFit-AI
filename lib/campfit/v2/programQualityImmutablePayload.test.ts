import { describe, expect, it } from "vitest"
import {
  createNullShadowSnapshotCandidate,
  immutablePayloadsEqual,
  normalizeDimensionScoreImmutablePayload,
  normalizeEvidenceImmutablePayload,
  normalizeObservationImmutablePayload,
  normalizeQualitySnapshotImmutablePayload,
  type ProgramEvidenceSourceCandidate,
  type ProgramFactObservationCandidate,
  type ProgramQualityDimensionScoreCandidate,
  type ProgramQualityScoreCandidate,
} from "@/lib/campfit/v2/programQualityImmutablePayload"

const ownedMetadata = {
  legacyVerificationId: "verification-1",
  legacyStatus: { safety_verified: "partial", operator_verified: "complete" },
  sourceSystem: "program_verifications",
  backfillVersion: "quality-phase1b-v1",
  mapperVersion: "legacy-mapper-v1",
  firstBackfillRunId: "run-1",
  riskLabelCount: 1,
  manualReviewCandidate: true,
} as const

function evidence(overrides: Partial<ProgramEvidenceSourceCandidate> = {}): ProgramEvidenceSourceCandidate {
  return {
    id: "evidence-1",
    programId: "program-1",
    sourceType: "legacy_program_verification",
    sourceUrl: "https://example.com/source",
    storagePath: null,
    title: "Legacy program verification record",
    sourceDate: "2026-07-01T00:00:00.000Z",
    validUntil: null,
    verificationStatus: "unverified",
    verifiedParticipation: false,
    isIndependent: false,
    canonicalUrl: null,
    contentHash: null,
    metadata: ownedMetadata,
    ...overrides,
  }
}

function observation(overrides: Partial<ProgramFactObservationCandidate> = {}): ProgramFactObservationCandidate {
  return {
    id: "observation-1",
    programId: "program-1",
    evidenceSourceId: "evidence-1",
    providerClaimId: null,
    dimensionKey: "safety_emergency",
    factKey: "legacy_completeness.safety_verified",
    factValue: { value: "partial", scoringEligible: false, source: "legacy_completeness" },
    normalizedNumericValue: null,
    unit: null,
    observationStatus: "extracted",
    observationConfidence: 0,
    observedAt: "2026-07-01T00:00:00.000Z",
    validUntil: null,
    extractionMethod: "imported",
    ...overrides,
  }
}

function snapshot(overrides: Partial<ProgramQualityScoreCandidate> = {}): ProgramQualityScoreCandidate {
  return {
    id: "snapshot-1",
    programId: "program-1",
    scoringVersionId: "version-1",
    calculationStatus: "shadow",
    overallQualityScore: null,
    evidenceConfidence: 0,
    confidenceLabel: "very_low",
    dimensionCoverageCount: 0,
    independentSourceCount: 0,
    criticalRiskCount: 0,
    publicEligible: false,
    publicStatusLabel: "운영 정보 확인 중",
    dataGaps: [],
    calculationSummary: { reason: "no_scoring_eligible_evidence", inputHash: "hash-1" },
    ...overrides,
  }
}

describe("programQualityImmutablePayload", () => {
  it("ignores server timestamps, JSON key order, and administrator metadata outside the allowlist", () => {
    const candidate = evidence()
    const persisted = {
      ...candidate,
      metadata: {
        administratorNote: "preserve this",
        ...ownedMetadata,
        legacyStatus: { operator_verified: "complete", safety_verified: "partial" },
      },
      collectedAt: "2026-07-11T01:00:00.000Z",
      createdAt: "2026-07-11T01:00:01.000Z",
      updatedAt: "2026-07-11T02:00:00.000Z",
    }

    expect(immutablePayloadsEqual(
      normalizeEvidenceImmutablePayload(candidate),
      normalizeEvidenceImmutablePayload(persisted),
    )).toBe(true)
  })

  it("treats every backfill-owned metadata field, including firstBackfillRunId, as immutable", () => {
    const baseline = normalizeEvidenceImmutablePayload(evidence())
    const changedRun = normalizeEvidenceImmutablePayload(evidence({
      metadata: { ...ownedMetadata, firstBackfillRunId: "run-2" },
    }))
    const changedRiskCount = normalizeEvidenceImmutablePayload(evidence({
      metadata: { ...ownedMetadata, riskLabelCount: 2 },
    }))

    expect(immutablePayloadsEqual(baseline, changedRun)).toBe(false)
    expect(immutablePayloadsEqual(baseline, changedRiskCount)).toBe(false)
  })

  it("detects sanitized source and canonical URL drift", () => {
    expect(immutablePayloadsEqual(
      normalizeEvidenceImmutablePayload(evidence()),
      normalizeEvidenceImmutablePayload(evidence({ sourceUrl: "https://example.com/other" })),
    )).toBe(false)
    expect(immutablePayloadsEqual(
      normalizeEvidenceImmutablePayload(evidence()),
      normalizeEvidenceImmutablePayload(evidence({ canonicalUrl: "https://example.com/canonical" })),
    )).toBe(false)
  })

  it("ignores observation timestamps and key order but detects fact-value drift", () => {
    const candidate = observation()
    const persisted = {
      ...candidate,
      factValue: { source: "legacy_completeness", scoringEligible: false, value: "partial" },
      createdAt: "2026-07-11T01:00:00.000Z",
      updatedAt: "2026-07-11T02:00:00.000Z",
    }
    const changed = observation({
      factValue: { value: "complete", scoringEligible: false, source: "legacy_completeness" },
    })

    expect(immutablePayloadsEqual(
      normalizeObservationImmutablePayload(candidate),
      normalizeObservationImmutablePayload(persisted),
    )).toBe(true)
    expect(immutablePayloadsEqual(
      normalizeObservationImmutablePayload(candidate),
      normalizeObservationImmutablePayload(changed),
    )).toBe(false)
  })

  it("detects quality input-hash drift while ignoring calculated and created timestamps", () => {
    const persisted = {
      ...snapshot(),
      calculatedAt: "2026-07-11T01:00:00.000Z",
      createdAt: "2026-07-11T01:00:01.000Z",
    }
    const changed = snapshot({
      calculationSummary: { reason: "no_scoring_eligible_evidence", inputHash: "hash-2" },
    })

    expect(immutablePayloadsEqual(
      normalizeQualitySnapshotImmutablePayload(snapshot()),
      normalizeQualitySnapshotImmutablePayload(persisted),
    )).toBe(true)
    expect(immutablePayloadsEqual(
      normalizeQualitySnapshotImmutablePayload(snapshot()),
      normalizeQualitySnapshotImmutablePayload(changed),
    )).toBe(false)
  })

  it("normalizes dimension score identity and score content without server timestamps", () => {
    const candidate: ProgramQualityDimensionScoreCandidate = {
      id: "dimension-1",
      programQualityScoreId: "snapshot-1",
      programId: "program-1",
      dimensionKey: "safety_emergency",
      priorScore: 60,
      observedScore: null,
      adjustedScore: null,
      dimensionConfidence: 0,
      evidenceCount: 0,
      independentSourceCount: 0,
      dataGaps: [],
      explanation: { inputHash: "hash-1", reason: "no_evidence" },
    }
    const persisted = {
      ...candidate,
      explanation: { reason: "no_evidence", inputHash: "hash-1" },
      createdAt: "2026-07-11T01:00:00.000Z",
    }

    expect(immutablePayloadsEqual(
      normalizeDimensionScoreImmutablePayload(candidate),
      normalizeDimensionScoreImmutablePayload(persisted),
    )).toBe(true)
  })

  it("creates deterministic normal shadow snapshots for no eligible evidence", () => {
    const first = createNullShadowSnapshotCandidate({
      programId: "program-1",
      scoringVersionId: "version-1",
      inputHash: "hash-1",
    })
    const repeated = createNullShadowSnapshotCandidate({
      programId: "program-1",
      scoringVersionId: "version-1",
      inputHash: "hash-1",
    })
    const changed = createNullShadowSnapshotCandidate({
      programId: "program-1",
      scoringVersionId: "version-1",
      inputHash: "hash-2",
    })

    expect(first).toMatchObject({
      calculationStatus: "shadow",
      overallQualityScore: null,
      evidenceConfidence: 0,
      confidenceLabel: "very_low",
      dimensionCoverageCount: 0,
      independentSourceCount: 0,
      criticalRiskCount: 0,
      publicEligible: false,
      publicStatusLabel: "운영 정보 확인 중",
      calculationSummary: { reason: "no_scoring_eligible_evidence", inputHash: "hash-1" },
    })
    expect(first.id).toBe(repeated.id)
    expect(first.id).not.toBe(changed.id)
    expect(first.calculationStatus).not.toBe("failed")
  })
})
