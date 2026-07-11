import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createProgramVerificationBackfillReadRepository,
  findBackfillProgramLinkWarnings,
  parseProgramVerificationBackfillScoringVersionRow,
} from "@/lib/campfit/v2/programVerificationBackfillReadCore"
import { createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"
import type {
  BackfillReadExecutor,
  BackfillReadRequest,
  BackfillReadResponse,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"

function legacyRow(id: string, programId: string) {
  return {
    id,
    program_id: programId,
    operator_verified: "complete",
    facility_verified: "partial",
    curriculum_verified: "partial",
    refund_verified: "missing",
    safety_verified: "partial",
    accommodation_verified: "partial",
    risk_labels: ["manual-review"],
    notes: ["private free-form note"],
    summary: "private summary",
    verified_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
  }
}

function createExecutor(handler: (request: BackfillReadRequest) => BackfillReadResponse | Promise<BackfillReadResponse>) {
  const execute = vi.fn(async (request: BackfillReadRequest) => handler(request))
  return {
    executor: { execute } satisfies BackfillReadExecutor,
    execute,
  }
}

describe("ProgramVerificationBackfillReadRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("trims, removes empty and duplicate program IDs, sorts the query, and returns deterministic verification order", async () => {
    const { executor, execute } = createExecutor(() => ({
      data: [legacyRow("verification-2", "program-b"), legacyRow("verification-3", "program-a"), legacyRow("verification-1", "program-a")],
      error: null,
    }))
    const repository = createProgramVerificationBackfillReadRepository(executor)

    const rows = await repository.loadLegacyProgramVerificationsByProgramIds([
      " program-b ",
      "program-a",
      "program-b",
      "   ",
    ])

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      kind: "rows",
      table: "program_verifications",
      filterColumn: "program_id",
      ids: ["program-a", "program-b"],
      orderBy: ["program_id", "id"],
    })
    const request = execute.mock.calls[0]?.[0]
    expect(request?.kind === "rows" ? request.columns : "").toContain("notes")
    expect(request?.kind === "rows" ? request.columns : "").not.toContain("verified_by")
    expect(rows.map((row) => `${row.program_id}:${row.id}`)).toEqual([
      "program-a:verification-1",
      "program-a:verification-3",
      "program-b:verification-2",
    ])
  })

  it("does not execute any query for empty ID sets", async () => {
    const { executor, execute } = createExecutor(() => ({ data: [], error: null }))
    const repository = createProgramVerificationBackfillReadRepository(executor)

    const results = await Promise.all([
      repository.loadLegacyProgramVerificationsByProgramIds([]),
      repository.loadProgramsForBackfill([" "]),
      repository.findExistingEvidenceByIds([]),
      repository.findExistingObservationsByIds([]),
      repository.findExistingQualitySnapshotsByIds([]),
      repository.findExistingDimensionScoresByIds([]),
    ])

    expect(results.every((result) => result.length === 0)).toBe(true)
    expect(execute).not.toHaveBeenCalled()
  })

  it("requests exact head-only counts for all five quality tables", async () => {
    const counts = new Map([
      ["program_evidence_sources", 7],
      ["program_fact_observations", 42],
      ["program_quality_scores", 5],
      ["program_quality_dimension_scores", 0],
      ["program_critical_risk_flags", 0],
    ])
    const { executor, execute } = createExecutor((request) => ({
      data: null,
      count: counts.get(request.table) ?? null,
      error: null,
    }))
    const repository = createProgramVerificationBackfillReadRepository(executor)

    await expect(repository.countQualityRowsExact()).resolves.toEqual({
      programEvidenceSources: 7,
      programFactObservations: 42,
      programQualityScores: 5,
      programQualityDimensionScores: 0,
      programCriticalRiskFlags: 0,
    })
    expect(execute).toHaveBeenCalledTimes(5)
    for (const [request] of execute.mock.calls) {
      expect(request).toMatchObject({ kind: "count", columns: "id", count: "exact", head: true })
    }
  })

  it("fails the whole count when one table fails and logs only safe Supabase fields", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { executor } = createExecutor((request) => {
      if (request.table !== "program_quality_scores") return { data: null, count: 0, error: null }
      return {
        data: null,
        count: null,
        error: {
          code: "READ_FAILED",
          message: "count failed",
          details: "safe detail",
          hint: "retry later",
          notes: ["private note"],
          serviceRoleKey: "super-secret-key",
        },
      }
    })
    const repository = createProgramVerificationBackfillReadRepository(executor)

    await expect(repository.countQualityRowsExact()).rejects.toThrow("Quality backfill read failed")
    const serializedLog = JSON.stringify(consoleError.mock.calls)
    expect(serializedLog).toContain("READ_FAILED")
    expect(serializedLog).not.toContain("private note")
    expect(serializedLog).not.toContain("super-secret-key")
    expect(serializedLog).not.toContain("serviceRoleKey")
  })

  it("loads only selected evidence columns and sorts existing rows by program and ID", async () => {
    const { executor, execute } = createExecutor(() => ({
      data: [
        {
          id: "evidence-2", program_id: "program-b", source_type: "legacy_program_verification",
          source_url: null, storage_path: null, title: null, source_date: null,
          collected_at: "2026-07-11T00:00:00.000Z", valid_until: null,
          verification_status: "unverified", verified_participation: false, is_independent: false,
          canonical_url: null, content_hash: null, metadata: {},
          created_at: "2026-07-11T00:00:00.000Z", updated_at: "2026-07-11T00:00:00.000Z",
        },
        {
          id: "evidence-1", program_id: "program-a", source_type: "legacy_program_verification",
          source_url: null, storage_path: null, title: null, source_date: null,
          collected_at: "2026-07-11T00:00:00.000Z", valid_until: null,
          verification_status: "unverified", verified_participation: false, is_independent: false,
          canonical_url: null, content_hash: null, metadata: {},
          created_at: "2026-07-11T00:00:00.000Z", updated_at: "2026-07-11T00:00:00.000Z",
        },
      ],
      error: null,
    }))
    const repository = createProgramVerificationBackfillReadRepository(executor)

    const rows = await repository.findExistingEvidenceByIds([" evidence-2 ", "evidence-1"])

    expect(rows.map((row) => row.id)).toEqual(["evidence-1", "evidence-2"])
    const request = execute.mock.calls[0]?.[0]
    expect(request?.kind === "rows" ? request.columns : "").not.toContain("created_by_user_id")
  })

  it("exposes a read-only interface and classifies missing program links without PII", () => {
    const { executor } = createExecutor(() => ({ data: [], error: null }))
    const repository = createProgramVerificationBackfillReadRepository(executor)

    expect(Object.keys(repository).sort()).toEqual([
      "countQualityRowsExact",
      "findExistingDimensionScoresByIds",
      "findExistingEvidenceByIds",
      "findExistingObservationsByIds",
      "findExistingQualitySnapshotsByIds",
      "loadLegacyProgramVerificationsByProgramIds",
      "loadProgramsForBackfill",
    ])
    expect("insert" in repository).toBe(false)
    expect("update" in repository).toBe(false)
    expect("delete" in repository).toBe(false)

    expect(findBackfillProgramLinkWarnings(
      [legacyRow("verification-1", "missing-program")],
      [{ id: "program-a" }],
    )).toEqual([{
      code: "legacy_verification_program_missing",
      programId: "missing-program",
      verificationId: "verification-1",
    }])
  })

  it("maps the database scoring row and normalizes Supabase timestamps for CLI use", () => {
    const version = createShadowProgramQualityScoringVersion()

    const mapped = parseProgramVerificationBackfillScoringVersionRow({
      id: version.id,
      version_key: version.versionKey,
      description: version.description ?? null,
      status: version.status,
      prior_score: version.priorScore,
      confidence_weights: version.confidenceWeights,
      dimension_weights: version.dimensionWeights,
      public_visibility_rules: version.publicVisibilityRules,
      rule_config: {
        ...version.ruleConfig,
        sourceAuthorityWeights: version.sourceAuthorityWeights,
      },
      created_at: "2026-07-11T00:00:00+00:00",
      activated_at: "2026-07-11T00:00:00+00:00",
      retired_at: null,
    })

    expect(mapped).toEqual(version)
    expect(mapped.createdAt).toBe("2026-07-11T00:00:00.000Z")
    expect(mapped.activatedAt).toBe("2026-07-11T00:00:00.000Z")
  })
})
