import { describe, expect, it, vi } from "vitest"
import { createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"
import type {
  LegacyProgramVerificationRow,
  ProgramVerificationBackfillReadRepository,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"
import {
  PILOT_PROGRAM_IDS,
  parseBackfillCliArgs,
  runBackfillCli,
  type BackfillCliDependencies,
} from "@/scripts/campfit/backfillProgramVerifications"

function verification(index: number, programId: string): LegacyProgramVerificationRow {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    program_id: programId,
    operator_verified: "complete",
    facility_verified: "partial",
    curriculum_verified: "partial",
    refund_verified: "missing",
    safety_verified: "partial",
    accommodation_verified: "partial",
    risk_labels: [],
    notes: [],
    summary: "private summary that must not be printed",
    verified_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
  }
}

function repository(): ProgramVerificationBackfillReadRepository {
  const programs = PILOT_PROGRAM_IDS.map((id, index) => ({ id, name: `Pilot ${index + 1}`, title: null }))
  const verifications = PILOT_PROGRAM_IDS.map((id, index) => verification(index + 1, id))
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
    findExistingEvidenceByIds: async () => [],
    findExistingObservationsByIds: async () => [],
    findExistingQualitySnapshotsByIds: async () => [],
    findExistingDimensionScoresByIds: async () => [],
  }
}

function dependencies(now: string) {
  const stdout: string[] = []
  const stderr: string[] = []
  const writeJsonOutput = vi.fn(async (_path: string, _content: string) => undefined)
  const createMutationDependencies = vi.fn(() => {
    throw new Error("Mutation dependencies must not be created during dry-run.")
  })
  const values: BackfillCliDependencies = {
    createReadRepository: () => repository(),
    loadScoringVersion: async () => createShadowProgramQualityScoringVersion(),
    getSupabaseUrl: () => "https://safeproject.supabase.co/rest/v1?apikey=super-secret-key",
    now: () => now,
    writeLine: (line) => stdout.push(line),
    writeError: (line) => stderr.push(line),
    writeJsonOutput,
    createMutationDependencies,
  }
  return { values, stdout, stderr, writeJsonOutput, createMutationDependencies }
}

describe("parseBackfillCliArgs", () => {
  it("defaults to a read-only five-program dry-run", () => {
    expect(parseBackfillCliArgs([])).toMatchObject({
      mode: "dry-run",
      limit: 5,
      limitWasExplicit: false,
      programIds: [],
    })
  })

  it("parses explicit program IDs and JSON output", () => {
    const options = parseBackfillCliArgs([
      "--dry-run",
      `--program-ids=${PILOT_PROGRAM_IDS.join(",")}`,
      "--json-output=report.json",
    ])
    expect(options.programIds).toEqual(PILOT_PROGRAM_IDS)
    expect(options.jsonOutput).toBe("report.json")
  })

  it("rejects conflicting modes, limit plus write, malformed values, and unknown arguments", () => {
    expect(() => parseBackfillCliArgs(["--dry-run", "--write"])).toThrow("cannot be used together")
    expect(() => parseBackfillCliArgs(["--write", "--limit=5"])).toThrow("--limit cannot be used with --write")
    expect(() => parseBackfillCliArgs(["--limit=0"])).toThrow("limit must be between 1 and 5")
    expect(() => parseBackfillCliArgs(["--unknown"])).toThrow("Unknown argument")
  })
})

describe("runBackfillCli", () => {
  it("runs the default dry-run without creating mutation dependencies", async () => {
    const deps = dependencies("2026-07-11T10:00:00.000Z")

    const exitCode = await runBackfillCli([], deps.values)
    const output = JSON.parse(deps.stdout[0] ?? "{}") as Record<string, unknown>

    expect(exitCode).toBe(0)
    expect(output["mode"]).toBe("dry-run")
    expect(output["targetProjectRef"]).toBe("safeproject")
    expect(output["countsUnchanged"]).toBe(true)
    expect(output["safety"]).toEqual({
      mutationDependencyFactoryCalls: 0,
      writerCalls: 0,
      supabaseMutationCalls: 0,
    })
    expect(deps.createMutationDependencies).not.toHaveBeenCalled()
    expect(deps.stderr).toEqual([])
  })

  it("produces the same deterministic report hash across runtime timestamps", async () => {
    const first = dependencies("2026-07-11T10:00:00.000Z")
    const second = dependencies("2026-07-11T11:00:00.000Z")

    await runBackfillCli([`--program-ids=${PILOT_PROGRAM_IDS.join(",")}`], first.values)
    await runBackfillCli([`--program-ids=${[...PILOT_PROGRAM_IDS].reverse().join(",")}`], second.values)
    const firstOutput = JSON.parse(first.stdout[0] ?? "{}") as { readonly dryRun?: { readonly deterministicReportHash?: string; readonly backfillRunId?: string } }
    const secondOutput = JSON.parse(second.stdout[0] ?? "{}") as { readonly dryRun?: { readonly deterministicReportHash?: string; readonly backfillRunId?: string } }

    expect(secondOutput.dryRun?.deterministicReportHash).toBe(firstOutput.dryRun?.deterministicReportHash)
    expect(secondOutput.dryRun?.backfillRunId).toBe(firstOutput.dryRun?.backfillRunId)
  })

  it("never prints the full URL, credentials, or legacy notes", async () => {
    const deps = dependencies("2026-07-11T10:00:00.000Z")

    await runBackfillCli([], deps.values)
    const output = `${deps.stdout.join("\n")}\n${deps.stderr.join("\n")}`

    expect(output).not.toContain("https://safeproject.supabase.co")
    expect(output).not.toContain("super-secret-key")
    expect(output).not.toContain("private summary")
    expect(output).not.toContain("apikey")
  })

  it("writes stable safe JSON output when requested", async () => {
    const deps = dependencies("2026-07-11T10:00:00.000Z")

    const exitCode = await runBackfillCli(["--json-output=report.json"], deps.values)

    expect(exitCode).toBe(0)
    expect(deps.writeJsonOutput).toHaveBeenCalledTimes(1)
    expect(deps.writeJsonOutput.mock.calls[0]?.[0]).toBe("report.json")
    expect(deps.writeJsonOutput.mock.calls[0]?.[1]).not.toContain("super-secret-key")
  })

  it("returns a non-zero exit code for invalid arguments without exposing values", async () => {
    const deps = dependencies("2026-07-11T10:00:00.000Z")

    const exitCode = await runBackfillCli(["--unknown=super-secret-key"], deps.values)

    expect(exitCode).not.toBe(0)
    expect(deps.stdout).toEqual([])
    expect(deps.stderr.join("\n")).not.toContain("super-secret-key")
  })

  it("rejects a wrong write project before creating mutation dependencies", async () => {
    const deps = dependencies("2026-07-11T10:00:00.000Z")

    const exitCode = await runBackfillCli([
      "--write",
      `--program-ids=${PILOT_PROGRAM_IDS.join(",")}`,
      "--confirm-program-count=5",
      "--confirm-production-write=QUALITY_PHASE1B_PILOT",
      "--expected-project-ref=wrongproject",
    ], deps.values)

    expect(exitCode).not.toBe(0)
    expect(deps.createMutationDependencies).not.toHaveBeenCalled()
    expect(deps.stderr.join("\n")).toContain("Unexpected Supabase project ref")
    expect(deps.stderr.join("\n")).not.toContain("https://safeproject.supabase.co")
  })
})
