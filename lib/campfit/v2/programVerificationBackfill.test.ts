import { describe, expect, it, vi } from "vitest"
import { backfillRunId } from "@/lib/campfit/v2/programQualityBackfillIdentity"
import type { ImmutableRowAdapter } from "@/lib/campfit/v2/programQualityBackfillWriter"
import type {
  ProgramEvidenceSourceCandidate,
  ProgramFactObservationCandidate,
  ProgramQualityDimensionScoreCandidate,
  ProgramQualityScoreCandidate,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import { createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"
import {
  normalizeAndValidateBackfillProgramIds,
  runProgramVerificationBackfillDryRun,
  runProgramVerificationBackfillWrite,
  type ProgramBackfillMutationDependencies,
} from "@/lib/campfit/v2/programVerificationBackfill"
import {
  LEGACY_VERIFICATION_BACKFILL_VERSION,
  LEGACY_VERIFICATION_MAPPER_VERSION,
  mapLegacyProgramVerification,
} from "@/lib/campfit/v2/programVerificationFactMapper"
import type {
  BackfillProgramRow,
  LegacyProgramVerificationRow,
  ProgramVerificationBackfillReadRepository,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"
import type { ProgramEvidenceSource } from "@/types/campfitProgramQuality"

const programA = "11111111-1111-4111-8111-111111111111"
const programB = "22222222-2222-4222-8222-222222222222"
const verificationA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const verificationB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function verification(id: string, programId: string): LegacyProgramVerificationRow {
  return {
    id,
    program_id: programId,
    operator_verified: "complete",
    facility_verified: "partial",
    curriculum_verified: "partial",
    refund_verified: "missing",
    safety_verified: "partial",
    accommodation_verified: "partial",
    risk_labels: [],
    notes: [],
    summary: "not logged or copied",
    verified_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
  }
}

function readRepository(input: {
  readonly programs?: readonly BackfillProgramRow[]
  readonly verifications?: readonly LegacyProgramVerificationRow[]
  readonly existingEvidence?: readonly ProgramEvidenceSource[]
} = {}): ProgramVerificationBackfillReadRepository {
  const programs = input.programs ?? [
    { id: programA, name: "Program A", title: null },
    { id: programB, name: "Program B", title: null },
  ]
  const verifications = input.verifications ?? [verification(verificationA, programA), verification(verificationB, programB)]
  const existingEvidence = input.existingEvidence ?? []
  return {
    loadLegacyProgramVerificationsByProgramIds: async (ids) => verifications.filter((row) => ids.includes(row.program_id)),
    loadProgramsForBackfill: async (ids) => programs.filter((row) => ids.includes(row.id)),
    countQualityRowsExact: async () => ({
      programEvidenceSources: 0,
      programFactObservations: 0,
      programQualityScores: 0,
      programQualityDimensionScores: 0,
      programCriticalRiskFlags: 0,
    }),
    findExistingEvidenceByIds: async (ids) => existingEvidence.filter((row) => ids.includes(row.id)),
    findExistingObservationsByIds: async () => [],
    findExistingQualitySnapshotsByIds: async () => [],
    findExistingDimensionScoresByIds: async () => [],
  }
}

function insertingAdapter<T>(): ImmutableRowAdapter<T> & {
  readonly findById: ReturnType<typeof vi.fn>
  readonly insert: ReturnType<typeof vi.fn>
} {
  return {
    findById: vi.fn(async (_id: string): Promise<T | null> => null),
    insert: vi.fn(async (row: T): Promise<T> => row),
  }
}

describe("runProgramVerificationBackfillDryRun", () => {
  const scoringVersion = createShadowProgramQualityScoringVersion()

  it("sorts programs and verifications and connects the production mapper output", async () => {
    const result = await runProgramVerificationBackfillDryRun({
      programIds: [` ${programB} `, programA, programB],
      readRepository: readRepository({
        verifications: [verification(verificationB, programB), verification(verificationA, programA)],
      }),
      scoringVersion,
    })

    expect(result.selectedPrograms.map((program) => program.programId)).toEqual([programA, programB])
    expect(result.programs.map((program) => program.programId)).toEqual([programA, programB])
    expect(result.programs.every((program) => program.status === "completed")).toBe(true)
    expect(result.programs.every((program) => program.evidencePlan.items.length === 1)).toBe(true)
    expect(result.programs.every((program) => program.observationPlan.items.length === 6)).toBe(true)
    expect(result.programs.every((program) => program.shadowPlan.calculationReason === "no_scoring_eligible_evidence")).toBe(true)
    expect(result.totals).toEqual({
      programs: 2,
      legacyVerifications: 2,
      evidenceCreate: 2,
      evidenceReuse: 0,
      evidenceDrift: 0,
      observationCreate: 12,
      observationReuse: 0,
      observationDrift: 0,
      scoringEligibleFacts: 0,
      dimensionInputs: 0,
      snapshotCreate: 2,
      snapshotReuse: 0,
      snapshotDrift: 0,
    })
  })

  it("produces the same run ID and report hash for reordered duplicate input", async () => {
    const repository = readRepository()
    const first = await runProgramVerificationBackfillDryRun({
      programIds: [programA, programB], readRepository: repository, scoringVersion,
    })
    const second = await runProgramVerificationBackfillDryRun({
      programIds: [programB, programA, programB], readRepository: repository, scoringVersion,
    })

    expect(second.backfillRunId).toBe(first.backfillRunId)
    expect(second.deterministicReportHash).toBe(first.deterministicReportHash)
    expect(second.programs).toEqual(first.programs)
  })

  it("marks immutable drift as partial without mutating the existing row", async () => {
    const row = verification(verificationA, programA)
    const runId = backfillRunId({
      backfillVersion: LEGACY_VERIFICATION_BACKFILL_VERSION,
      mapperVersion: LEGACY_VERIFICATION_MAPPER_VERSION,
      programIds: [programA],
      legacyVerificationIds: [verificationA],
    })
    const candidate = mapLegacyProgramVerification({ verification: row, program: { id: programA }, backfillRunId: runId }).evidence
    const existing: ProgramEvidenceSource = {
      id: candidate.id,
      programId: candidate.programId,
      sourceType: candidate.sourceType,
      title: candidate.title,
      collectedAt: "2026-07-11T00:00:00.000Z",
      verificationStatus: candidate.verificationStatus,
      verifiedParticipation: candidate.verifiedParticipation,
      isIndependent: candidate.isIndependent,
      metadata: { ...candidate.metadata, firstBackfillRunId: "different-run" },
    }
    const before = structuredClone(existing)

    const result = await runProgramVerificationBackfillDryRun({
      programIds: [programA],
      readRepository: readRepository({ programs: [{ id: programA, name: "Program A", title: null }], verifications: [row], existingEvidence: [existing] }),
      scoringVersion,
    })

    expect(result.programs[0]?.status).toBe("partial")
    expect(result.programs[0]?.evidencePlan.drift).toBe(1)
    expect(result.totals.evidenceDrift).toBe(1)
    expect(existing).toEqual(before)
  })

  it("isolates a missing program failure from other programs", async () => {
    const result = await runProgramVerificationBackfillDryRun({
      programIds: [programA, programB],
      readRepository: readRepository({
        programs: [{ id: programA, name: "Program A", title: null }],
        verifications: [verification(verificationA, programA)],
      }),
      scoringVersion,
    })

    expect(result.programs.find((program) => program.programId === programA)?.status).toBe("completed")
    expect(result.programs.find((program) => program.programId === programB)).toMatchObject({
      status: "failed",
      errors: ["program_not_found"],
    })
    expect(result.totals.programs).toBe(2)
    expect(result.totals.evidenceCreate).toBe(1)
    expect(result.totals.snapshotDrift).toBe(0)
  })
})

describe("write guard", () => {
  const scoringVersion = createShadowProgramQualityScoringVersion()
  const fivePrograms = [
    programA,
    programB,
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ]

  it("normalizes valid IDs and rejects empty, malformed, and over-limit inputs", () => {
    expect(normalizeAndValidateBackfillProgramIds([` ${programB} `, programA, programB])).toEqual([programA, programB])
    expect(() => normalizeAndValidateBackfillProgramIds([])).toThrow("At least one explicit program UUID is required")
    expect(() => normalizeAndValidateBackfillProgramIds(["not-a-uuid"])).toThrow("Program IDs must be valid UUIDs")
    expect(() => normalizeAndValidateBackfillProgramIds([...fivePrograms, "66666666-6666-4666-8666-666666666666"])).toThrow("At most five unique program UUIDs are allowed")
  })

  it("never creates mutation dependencies before every write guard passes", async () => {
    const createMutationDependencies = vi.fn((): ProgramBackfillMutationDependencies => {
      throw new Error("Mutation dependencies must not be created before guards pass.")
    })
    const base = {
      programIds: fivePrograms,
      supabaseUrl: "https://actualref.supabase.co",
      expectedProjectRef: "actualref",
      confirmation: { confirmedProgramCount: 5, productionLiteral: "QUALITY_PHASE1B_PILOT" },
      readRepository: readRepository(),
      createMutationDependencies,
      scoringVersion,
    }

    await expect(runProgramVerificationBackfillWrite({ ...base, programIds: [] })).rejects.toThrow()
    await expect(runProgramVerificationBackfillWrite({ ...base, programIds: ["invalid"] })).rejects.toThrow()
    await expect(runProgramVerificationBackfillWrite({ ...base, programIds: [...fivePrograms, "66666666-6666-4666-8666-666666666666"] })).rejects.toThrow()
    await expect(runProgramVerificationBackfillWrite({ ...base, confirmation: { ...base.confirmation, confirmedProgramCount: 4 } })).rejects.toThrow("Confirmed program count")
    await expect(runProgramVerificationBackfillWrite({ ...base, confirmation: { ...base.confirmation, productionLiteral: "WRONG" } })).rejects.toThrow("Production confirmation literal")
    await expect(runProgramVerificationBackfillWrite({ ...base, expectedProjectRef: "" })).rejects.toThrow("Expected Supabase project ref")
    await expect(runProgramVerificationBackfillWrite({ ...base, expectedProjectRef: "wrongref" })).rejects.toThrow("Unexpected Supabase project ref")

    expect(createMutationDependencies).not.toHaveBeenCalled()
  })

  it("creates mutation dependencies once and uses insert-or-verify only after valid guards", async () => {
    const rows = fivePrograms.map((id, index) => verification(
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      id,
    ))
    const programs = fivePrograms.map((id, index) => ({ id, name: `Program ${index + 1}`, title: null }))
    const evidenceAdapter = insertingAdapter<ProgramEvidenceSourceCandidate>()
    const observationAdapter = insertingAdapter<ProgramFactObservationCandidate>()
    const snapshotAdapter = insertingAdapter<ProgramQualityScoreCandidate>()
    const dimensionScoreAdapter = insertingAdapter<ProgramQualityDimensionScoreCandidate>()
    const createMutationDependencies = vi.fn((): ProgramBackfillMutationDependencies => ({
      evidenceAdapter,
      observationAdapter,
      snapshotAdapter,
      dimensionScoreAdapter,
    }))

    const result = await runProgramVerificationBackfillWrite({
      programIds: fivePrograms,
      supabaseUrl: "https://actualref.supabase.co",
      expectedProjectRef: "actualref",
      confirmation: { confirmedProgramCount: 5, productionLiteral: "QUALITY_PHASE1B_PILOT" },
      readRepository: readRepository({ programs, verifications: rows }),
      createMutationDependencies,
      scoringVersion,
    })

    expect(createMutationDependencies).toHaveBeenCalledTimes(1)
    expect(result.evidence).toHaveLength(5)
    expect(result.observations).toHaveLength(30)
    expect(result.snapshots).toHaveLength(5)
    expect(result.dimensionScores).toHaveLength(0)
    expect(evidenceAdapter.insert).toHaveBeenCalledTimes(5)
    expect(observationAdapter.insert).toHaveBeenCalledTimes(30)
    expect(snapshotAdapter.insert).toHaveBeenCalledTimes(5)
    expect("update" in evidenceAdapter).toBe(false)
  })
})
