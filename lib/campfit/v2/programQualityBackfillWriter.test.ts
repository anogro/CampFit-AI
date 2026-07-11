import { describe, expect, it, vi } from "vitest"
import {
  insertOrVerifyDimensionScore,
  insertOrVerifyEvidence,
  insertOrVerifyImmutable,
  insertOrVerifyObservation,
  insertOrVerifyShadowSnapshot,
  type ImmutableRowAdapter,
} from "@/lib/campfit/v2/programQualityBackfillWriter"
import {
  createNullShadowSnapshotCandidate,
  type ProgramEvidenceSourceCandidate,
  type ProgramFactObservationCandidate,
  type ProgramQualityDimensionScoreCandidate,
} from "@/lib/campfit/v2/programQualityImmutablePayload"

function adapterFor<T>(existing: T | null): ImmutableRowAdapter<T> & {
  readonly findById: ReturnType<typeof vi.fn>
  readonly insert: ReturnType<typeof vi.fn>
} {
  return {
    findById: vi.fn(async () => existing),
    insert: vi.fn(async (row: T) => row),
  }
}

const evidence: ProgramEvidenceSourceCandidate = {
  id: "evidence-1",
  programId: "program-1",
  sourceType: "legacy_program_verification",
  sourceUrl: "https://example.com/source",
  verificationStatus: "unverified",
  verifiedParticipation: false,
  isIndependent: false,
  metadata: {
    legacyVerificationId: "verification-1",
    legacyStatus: {},
    sourceSystem: "program_verifications",
    backfillVersion: "quality-phase1b-v1",
    mapperVersion: "legacy-mapper-v1",
    firstBackfillRunId: "run-1",
    riskLabelCount: 0,
    manualReviewCandidate: false,
  },
}

const observation: ProgramFactObservationCandidate = {
  id: "observation-1",
  programId: "program-1",
  evidenceSourceId: "evidence-1",
  providerClaimId: null,
  dimensionKey: "safety_emergency",
  factKey: "legacy_completeness.safety_verified",
  factValue: { value: "partial", scoringEligible: false },
  normalizedNumericValue: null,
  unit: null,
  observationStatus: "extracted",
  observationConfidence: 0,
  observedAt: null,
  validUntil: null,
  extractionMethod: "imported",
}

const dimension: ProgramQualityDimensionScoreCandidate = {
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
  explanation: { reason: "no_evidence" },
}

describe("insertOrVerifyImmutable", () => {
  it("inserts exactly once when no row exists", async () => {
    const adapter = adapterFor<{ readonly id: string; readonly value: number }>(null)
    const expected = { id: "row-1", value: 1 }

    const result = await insertOrVerifyImmutable({
      id: expected.id,
      expected,
      adapter,
      normalize: (row) => row,
    })

    expect(result).toEqual({ action: "inserted", row: expected })
    expect(adapter.findById).toHaveBeenCalledWith("row-1")
    expect(adapter.insert).toHaveBeenCalledTimes(1)
  })

  it("reuses an identical row without inserting", async () => {
    const existing = { id: "row-1", value: { b: 2, a: 1 } }
    const adapter = adapterFor(existing)

    const result = await insertOrVerifyImmutable({
      id: "row-1",
      expected: { id: "row-1", value: { a: 1, b: 2 } },
      adapter,
      normalize: (row) => row,
    })

    expect(result).toEqual({ action: "reused", row: existing })
    expect(adapter.insert).not.toHaveBeenCalled()
  })

  it("fails closed with a typed drift result and never mutates the existing row", async () => {
    const existing = { id: "row-1", value: 1 }
    const before = structuredClone(existing)
    const adapter = adapterFor(existing)

    const result = await insertOrVerifyImmutable({
      id: "row-1",
      expected: { id: "row-1", value: 2 },
      adapter,
      normalize: (row) => row,
    })

    expect(result).toEqual({
      action: "drift",
      drift: {
        existing: { id: "row-1", value: 1 },
        expected: { id: "row-1", value: 2 },
      },
    })
    expect(adapter.insert).not.toHaveBeenCalled()
    expect(existing).toEqual(before)
    expect("update" in adapter).toBe(false)
  })

  it("uses evidence normalization so administrator metadata remains preserved and reusable", async () => {
    const persisted = {
      ...evidence,
      metadata: { ...evidence.metadata, administratorNote: "do not overwrite" },
    }
    const adapter = adapterFor<ProgramEvidenceSourceCandidate>(persisted)

    const result = await insertOrVerifyEvidence({ expected: evidence, adapter })

    expect(result.action).toBe("reused")
    expect(adapter.insert).not.toHaveBeenCalled()
    expect(persisted.metadata).toHaveProperty("administratorNote", "do not overwrite")
  })

  it("provides immutable wrappers for observations, shadow snapshots, and dimension scores", async () => {
    const observationAdapter = adapterFor<ProgramFactObservationCandidate>(observation)
    const snapshot = createNullShadowSnapshotCandidate({
      programId: "program-1",
      scoringVersionId: "version-1",
      inputHash: "hash-1",
    })
    const snapshotAdapter = adapterFor(snapshot)
    const dimensionAdapter = adapterFor<ProgramQualityDimensionScoreCandidate>(dimension)

    await expect(insertOrVerifyObservation({ expected: observation, adapter: observationAdapter }))
      .resolves.toMatchObject({ action: "reused" })
    await expect(insertOrVerifyShadowSnapshot({ expected: snapshot, adapter: snapshotAdapter }))
      .resolves.toMatchObject({ action: "reused" })
    await expect(insertOrVerifyDimensionScore({ expected: dimension, adapter: dimensionAdapter }))
      .resolves.toMatchObject({ action: "reused" })
    expect(observationAdapter.insert).not.toHaveBeenCalled()
    expect(snapshotAdapter.insert).not.toHaveBeenCalled()
    expect(dimensionAdapter.insert).not.toHaveBeenCalled()
  })
})
