import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { loadEnvConfig } from "@next/env"
import {
  assertExpectedSupabaseProject,
  extractSupabaseProjectRef,
  SupabaseProjectGuardError,
} from "@/lib/campfit/v2/programQualityProjectGuard"
import {
  normalizeAndValidateBackfillProgramIds,
  ProgramBackfillValidationError,
  runProgramVerificationBackfillDryRun,
  runProgramVerificationBackfillWrite,
} from "@/lib/campfit/v2/programVerificationBackfill"
import type {
  ProgramBackfillMutationDependencies,
} from "@/lib/campfit/v2/programVerificationBackfill"
import type {
  ProgramQualityTableCounts,
  ProgramVerificationBackfillReadRepository,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"
import type { ProgramQualityScoringVersion } from "@/types/campfitProgramQuality"
import { createProgramVerificationBackfillCliAdapterFromEnvironment } from "@/scripts/campfit/programVerificationBackfillCliAdapter"

export const PILOT_PROGRAM_IDS = [
  "fa6fa0f8-ecec-486e-bcfa-ca299fd978af",
  "f6dcee13-6d60-4891-b72c-510d1d5ad726",
  "bd54f391-4315-41ee-96aa-27bdb63dd5a6",
  "1cb1a728-03d5-4bce-ad16-71ca03a4477e",
  "d1ea93fc-873a-416a-bac4-6aaeaf8952da",
] as const

export interface BackfillCliOptions {
  readonly mode: "dry-run" | "write"
  readonly limit: number
  readonly limitWasExplicit: boolean
  readonly programIds: readonly string[]
  readonly confirmedProgramCount?: number
  readonly productionLiteral?: string
  readonly expectedProjectRef?: string
  readonly jsonOutput?: string
}

export interface BackfillCliDependencies {
  readonly createReadRepository: () => ProgramVerificationBackfillReadRepository | null
  readonly loadScoringVersion: () => Promise<ProgramQualityScoringVersion | null>
  readonly getSupabaseUrl: () => string | undefined
  readonly now: () => string
  readonly writeLine: (line: string) => void
  readonly writeError: (line: string) => void
  readonly writeJsonOutput: (path: string, content: string) => Promise<void>
  readonly createMutationDependencies?: () => ProgramBackfillMutationDependencies
}

export class BackfillCliUsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BackfillCliUsageError"
  }
}

export function parseBackfillCliArgs(args: readonly string[]): BackfillCliOptions {
  let dryRunRequested = false
  let writeRequested = false
  let limit = 5
  let limitWasExplicit = false
  let programIds: readonly string[] = []
  let confirmedProgramCount: number | undefined
  let productionLiteral: string | undefined
  let expectedProjectRef: string | undefined
  let jsonOutput: string | undefined

  for (const argument of args) {
    if (argument === "--dry-run") {
      dryRunRequested = true
      continue
    }
    if (argument === "--write") {
      writeRequested = true
      continue
    }
    if (argument.startsWith("--limit=")) {
      limit = parseIntegerOption(argument, "--limit=")
      limitWasExplicit = true
      continue
    }
    if (argument.startsWith("--program-ids=")) {
      programIds = optionValue(argument, "--program-ids=").split(",").map((value) => value.trim()).filter(Boolean)
      continue
    }
    if (argument.startsWith("--confirm-program-count=")) {
      confirmedProgramCount = parseIntegerOption(argument, "--confirm-program-count=")
      continue
    }
    if (argument.startsWith("--confirm-production-write=")) {
      productionLiteral = optionValue(argument, "--confirm-production-write=")
      continue
    }
    if (argument.startsWith("--expected-project-ref=")) {
      expectedProjectRef = optionValue(argument, "--expected-project-ref=")
      continue
    }
    if (argument.startsWith("--json-output=")) {
      jsonOutput = optionValue(argument, "--json-output=")
      continue
    }
    throw new BackfillCliUsageError("Unknown argument.")
  }

  if (dryRunRequested && writeRequested) {
    throw new BackfillCliUsageError("--dry-run and --write cannot be used together.")
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new BackfillCliUsageError("limit must be between 1 and 5.")
  }
  if (writeRequested && limitWasExplicit) {
    throw new BackfillCliUsageError("--limit cannot be used with --write.")
  }

  return {
    mode: writeRequested ? "write" : "dry-run",
    limit,
    limitWasExplicit,
    programIds,
    ...(confirmedProgramCount === undefined ? {} : { confirmedProgramCount }),
    ...(productionLiteral === undefined ? {} : { productionLiteral }),
    ...(expectedProjectRef === undefined ? {} : { expectedProjectRef }),
    ...(jsonOutput === undefined ? {} : { jsonOutput }),
  }
}

export async function runBackfillCli(
  args: readonly string[],
  dependencies: BackfillCliDependencies,
): Promise<number> {
  try {
    const options = parseBackfillCliArgs(args)
    const supabaseUrl = dependencies.getSupabaseUrl()
    if (supabaseUrl === undefined || supabaseUrl.trim().length === 0) {
      throw new BackfillCliUsageError("Supabase URL is not configured.")
    }
    const targetProjectRef = extractSupabaseProjectRef(supabaseUrl)
    const readRepository = dependencies.createReadRepository()
    if (readRepository === null) throw new BackfillCliUsageError("Supabase read repository is not configured.")
    const scoringVersion = await dependencies.loadScoringVersion()
    if (scoringVersion === null) throw new BackfillCliUsageError("Shadow scoring version is unavailable.")

    if (options.mode === "write") {
      return await runWriteMode({ options, dependencies, readRepository, scoringVersion, supabaseUrl, targetProjectRef })
    }

    const selectedProgramIds = options.programIds.length > 0
      ? normalizeAndValidateBackfillProgramIds(options.programIds)
      : normalizeAndValidateBackfillProgramIds(PILOT_PROGRAM_IDS.slice(0, options.limit))
    const countsBefore = await readRepository.countQualityRowsExact()
    const dryRun = await runProgramVerificationBackfillDryRun({
      programIds: selectedProgramIds,
      readRepository,
      scoringVersion,
    })
    const countsAfter = await readRepository.countQualityRowsExact()
    const countsUnchanged = tableCountsEqual(countsBefore, countsAfter)
    const output = {
      executedAt: dependencies.now(),
      mode: "dry-run" as const,
      targetProjectRef,
      selectedProgramIds,
      countsBefore,
      countsAfter,
      countsUnchanged,
      dryRun,
      safety: {
        mutationDependencyFactoryCalls: 0,
        writerCalls: 0,
        supabaseMutationCalls: 0,
      },
    }
    const serialized = JSON.stringify(output, null, 2)
    dependencies.writeLine(serialized)
    if (options.jsonOutput !== undefined) await dependencies.writeJsonOutput(options.jsonOutput, `${serialized}\n`)
    const hasProgramFailure = dryRun.programs.some((program) => program.status !== "completed")
    return countsUnchanged && !hasProgramFailure ? 0 : 1
  } catch (error) {
    dependencies.writeError(safeErrorMessage(error))
    return 2
  }
}

async function runWriteMode(input: {
  readonly options: BackfillCliOptions
  readonly dependencies: BackfillCliDependencies
  readonly readRepository: ProgramVerificationBackfillReadRepository
  readonly scoringVersion: ProgramQualityScoringVersion
  readonly supabaseUrl: string
  readonly targetProjectRef: string
}): Promise<number> {
  const programIds = normalizeAndValidateBackfillProgramIds(input.options.programIds)
  if (input.options.confirmedProgramCount === undefined) {
    throw new BackfillCliUsageError("--confirm-program-count is required for write mode.")
  }
  if (input.options.productionLiteral === undefined) {
    throw new BackfillCliUsageError("--confirm-production-write is required for write mode.")
  }
  if (input.options.expectedProjectRef === undefined || input.options.expectedProjectRef.trim().length === 0) {
    throw new BackfillCliUsageError("--expected-project-ref is required for write mode.")
  }
  assertExpectedSupabaseProject({
    supabaseUrl: input.supabaseUrl,
    expectedProjectRef: input.options.expectedProjectRef,
  })
  if (input.dependencies.createMutationDependencies === undefined) {
    throw new BackfillCliUsageError("Production mutation dependencies are not configured.")
  }

  const result = await runProgramVerificationBackfillWrite({
    programIds,
    supabaseUrl: input.supabaseUrl,
    expectedProjectRef: input.options.expectedProjectRef,
    confirmation: {
      confirmedProgramCount: input.options.confirmedProgramCount,
      productionLiteral: input.options.productionLiteral,
    },
    readRepository: input.readRepository,
    createMutationDependencies: input.dependencies.createMutationDependencies,
    scoringVersion: input.scoringVersion,
  })
  const writerCalls = result.evidence.length + result.observations.length + result.snapshots.length + result.dimensionScores.length
  const supabaseMutationCalls = [result.evidence, result.observations, result.snapshots, result.dimensionScores]
    .flat()
    .filter((item) => item.action === "inserted")
    .length
  const output = {
    executedAt: input.dependencies.now(),
    mode: "write" as const,
    targetProjectRef: input.targetProjectRef,
    selectedProgramIds: programIds,
    dryRun: result.dryRun,
    safety: {
      mutationDependencyFactoryCalls: 1,
      writerCalls,
      supabaseMutationCalls,
    },
  }
  const serialized = JSON.stringify(output, null, 2)
  input.dependencies.writeLine(serialized)
  if (input.options.jsonOutput !== undefined) await input.dependencies.writeJsonOutput(input.options.jsonOutput, `${serialized}\n`)
  return result.dryRun.programs.every((program) => program.status === "completed") ? 0 : 1
}

function tableCountsEqual(left: ProgramQualityTableCounts, right: ProgramQualityTableCounts): boolean {
  return left.programEvidenceSources === right.programEvidenceSources
    && left.programFactObservations === right.programFactObservations
    && left.programQualityScores === right.programQualityScores
    && left.programQualityDimensionScores === right.programQualityDimensionScores
    && left.programCriticalRiskFlags === right.programCriticalRiskFlags
}

function parseIntegerOption(argument: string, prefix: string): number {
  const value = optionValue(argument, prefix)
  if (!/^\d+$/.test(value)) throw new BackfillCliUsageError("Numeric argument is invalid.")
  return Number(value)
}

function optionValue(argument: string, prefix: string): string {
  const value = argument.slice(prefix.length).trim()
  if (value.length === 0) throw new BackfillCliUsageError("Argument value is required.")
  return value
}

function safeErrorMessage(error: unknown): string {
  if (
    error instanceof BackfillCliUsageError
    || error instanceof ProgramBackfillValidationError
    || error instanceof SupabaseProjectGuardError
  ) {
    return error.message
  }
  return "CampFit quality backfill failed."
}

function createDefaultDependencies(): BackfillCliDependencies {
  const cliAdapter = createProgramVerificationBackfillCliAdapterFromEnvironment()
  return {
    createReadRepository: () => cliAdapter?.readRepository ?? null,
    loadScoringVersion: async () => cliAdapter === null ? null : cliAdapter.loadScoringVersion(),
    getSupabaseUrl: () => process.env["NEXT_PUBLIC_SUPABASE_URL"],
    now: () => new Date().toISOString(),
    writeLine: (line) => console.log(line),
    writeError: (line) => console.error(line),
    writeJsonOutput: async (path, content) => writeFile(resolve(path), content, "utf8"),
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd())
  process.exitCode = await runBackfillCli(process.argv.slice(2), createDefaultDependencies())
}

if (process.env["VITEST"] !== "true") {
  await main()
}
