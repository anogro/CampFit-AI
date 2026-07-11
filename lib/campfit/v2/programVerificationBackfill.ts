import {
  backfillRunId,
  qualityInputHash,
} from "@/lib/campfit/v2/programQualityBackfillIdentity"
import type { ImmutableRowAdapter, InsertOrVerifyResult } from "@/lib/campfit/v2/programQualityBackfillWriter"
import {
  insertOrVerifyDimensionScore,
  insertOrVerifyEvidence,
  insertOrVerifyObservation,
  insertOrVerifyShadowSnapshot,
} from "@/lib/campfit/v2/programQualityBackfillWriter"
import {
  immutablePayloadsEqual,
  normalizeEvidenceImmutablePayload,
  normalizeObservationImmutablePayload,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import type {
  ProgramEvidenceSourceCandidate,
  ProgramFactObservationCandidate,
  ProgramQualityDimensionScoreCandidate,
  ProgramQualityScoreCandidate,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import { assertExpectedSupabaseProject } from "@/lib/campfit/v2/programQualityProjectGuard"
import { buildProgramShadowCalculationPlan } from "@/lib/campfit/v2/programQualityShadowRunner"
import {
  LEGACY_VERIFICATION_BACKFILL_VERSION,
  LEGACY_VERIFICATION_MAPPER_VERSION,
  mapLegacyProgramVerification,
} from "@/lib/campfit/v2/programVerificationFactMapper"
import type {
  LegacyProgramVerification,
  LegacyVerificationMappingResult,
} from "@/lib/campfit/v2/programVerificationFactMapper"
import type {
  BackfillProgramRow,
  LegacyProgramVerificationRow,
  ProgramVerificationBackfillReadRepository,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"
import type {
  ProgramEvidenceSource,
  ProgramFactObservation,
  ProgramQualityScoringVersion,
} from "@/types/campfitProgramQuality"

export const QUALITY_PHASE1B_PRODUCTION_CONFIRMATION = "QUALITY_PHASE1B_PILOT" as const

export type ProgramBackfillStatus = "completed" | "partial" | "failed"
export type ProgramBackfillPlanAction = "create" | "reuse" | "drift"

export interface ProgramBackfillItemPlan {
  readonly id: string
  readonly action: ProgramBackfillPlanAction
}

export interface ProgramBackfillImmutablePlan {
  readonly create: number
  readonly reuse: number
  readonly drift: number
  readonly items: readonly ProgramBackfillItemPlan[]
}

export interface ProgramBackfillDryRunResult {
  readonly programId: string
  readonly programName: string
  readonly status: ProgramBackfillStatus
  readonly legacyVerificationCount: number
  readonly evidencePlan: ProgramBackfillImmutablePlan
  readonly observationPlan: ProgramBackfillImmutablePlan
  readonly scoringEligibleFactCount: number
  readonly dimensionInputCount: number
  readonly shadowPlan: {
    readonly action: ProgramBackfillPlanAction
    readonly snapshotId: string
    readonly inputHash: string
    readonly overallQualityScore: number | null
    readonly evidenceConfidence: number
    readonly dimensionCoverageCount: number
    readonly publicEligible: boolean
    readonly publicStatusLabel: string
    readonly calculationReason: string
  }
  readonly unresolved: readonly string[]
  readonly warnings: readonly string[]
  readonly errors: readonly string[]
}

export interface ProgramBackfillBatchDryRunResult {
  readonly backfillRunId: string
  readonly mapperVersion: string
  readonly backfillVersion: string
  readonly selectedPrograms: readonly {
    readonly programId: string
    readonly programName: string
  }[]
  readonly programs: readonly ProgramBackfillDryRunResult[]
  readonly totals: {
    readonly programs: number
    readonly legacyVerifications: number
    readonly evidenceCreate: number
    readonly evidenceReuse: number
    readonly evidenceDrift: number
    readonly observationCreate: number
    readonly observationReuse: number
    readonly observationDrift: number
    readonly scoringEligibleFacts: number
    readonly dimensionInputs: number
    readonly snapshotCreate: number
    readonly snapshotReuse: number
    readonly snapshotDrift: number
  }
  readonly deterministicReportHash: string
}

export interface ProgramBackfillMutationDependencies {
  readonly evidenceAdapter: ImmutableRowAdapter<ProgramEvidenceSourceCandidate>
  readonly observationAdapter: ImmutableRowAdapter<ProgramFactObservationCandidate>
  readonly snapshotAdapter: ImmutableRowAdapter<ProgramQualityScoreCandidate>
  readonly dimensionScoreAdapter: ImmutableRowAdapter<ProgramQualityDimensionScoreCandidate>
}

export interface ProgramBackfillWriteResult {
  readonly dryRun: ProgramBackfillBatchDryRunResult
  readonly evidence: readonly InsertOrVerifyResult<ProgramEvidenceSourceCandidate>[]
  readonly observations: readonly InsertOrVerifyResult<ProgramFactObservationCandidate>[]
  readonly snapshots: readonly InsertOrVerifyResult<ProgramQualityScoreCandidate>[]
  readonly dimensionScores: readonly InsertOrVerifyResult<ProgramQualityDimensionScoreCandidate>[]
}

export class ProgramBackfillValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProgramBackfillValidationError"
  }
}

interface BatchReadContext {
  readonly programIds: readonly string[]
  readonly programsById: ReadonlyMap<string, BackfillProgramRow>
  readonly verificationsByProgramId: ReadonlyMap<string, readonly LegacyProgramVerificationRow[]>
  readonly backfillRunId: string
}

interface MappedProgramContext {
  readonly program: BackfillProgramRow
  readonly verifications: readonly LegacyProgramVerificationRow[]
  readonly mappings: readonly LegacyVerificationMappingResult[]
  readonly evidence: readonly ProgramEvidenceSourceCandidate[]
  readonly observations: readonly ProgramFactObservationCandidate[]
}

export function normalizeAndValidateBackfillProgramIds(programIds: readonly string[]): readonly string[] {
  const normalized = [...new Set(programIds.map((programId) => programId.trim()).filter((programId) => programId.length > 0))]
    .sort(compareCodeUnits)
  if (normalized.length === 0) {
    throw new ProgramBackfillValidationError("At least one explicit program UUID is required.")
  }
  if (normalized.some((programId) => !UUID_PATTERN.test(programId))) {
    throw new ProgramBackfillValidationError("Program IDs must be valid UUIDs.")
  }
  if (normalized.length > 5) {
    throw new ProgramBackfillValidationError("At most five unique program UUIDs are allowed.")
  }
  return normalized
}

export async function runProgramVerificationBackfillDryRun(input: {
  readonly programIds: readonly string[]
  readonly readRepository: ProgramVerificationBackfillReadRepository
  readonly scoringVersion: ProgramQualityScoringVersion
}): Promise<ProgramBackfillBatchDryRunResult> {
  const programIds = normalizeAndValidateBackfillProgramIds(input.programIds)
  const context = await loadBatchReadContext(programIds, input.readRepository)
  const selectedPrograms = programIds.map((programId) => ({
    programId,
    programName: programName(context.programsById.get(programId), programId),
  }))
  const programs: ProgramBackfillDryRunResult[] = []

  for (const programId of programIds) {
    programs.push(await planProgramDryRun({
      programId,
      context,
      readRepository: input.readRepository,
      scoringVersion: input.scoringVersion,
    }))
  }

  const totals = totalPrograms(programs)
  const reportPayload = {
    backfillRunId: context.backfillRunId,
    mapperVersion: LEGACY_VERIFICATION_MAPPER_VERSION,
    backfillVersion: LEGACY_VERIFICATION_BACKFILL_VERSION,
    selectedPrograms,
    programs,
    totals,
  }

  return {
    ...reportPayload,
    deterministicReportHash: qualityInputHash(reportPayload),
  }
}

export async function runProgramVerificationBackfillWrite(input: {
  readonly programIds: readonly string[]
  readonly supabaseUrl: string
  readonly expectedProjectRef: string
  readonly confirmation: {
    readonly confirmedProgramCount: number
    readonly productionLiteral: string
  }
  readonly readRepository: ProgramVerificationBackfillReadRepository
  readonly createMutationDependencies: () => ProgramBackfillMutationDependencies
  readonly scoringVersion: ProgramQualityScoringVersion
}): Promise<ProgramBackfillWriteResult> {
  const programIds = normalizeAndValidateBackfillProgramIds(input.programIds)
  if (programIds.length !== 5) {
    throw new ProgramBackfillValidationError("The Phase 1B pilot write requires exactly five unique program UUIDs.")
  }
  if (input.confirmation.confirmedProgramCount !== programIds.length) {
    throw new ProgramBackfillValidationError("Confirmed program count must match the unique program UUID count.")
  }
  if (input.confirmation.productionLiteral !== QUALITY_PHASE1B_PRODUCTION_CONFIRMATION) {
    throw new ProgramBackfillValidationError("Production confirmation literal is invalid.")
  }
  assertExpectedSupabaseProject({
    supabaseUrl: input.supabaseUrl,
    expectedProjectRef: input.expectedProjectRef,
  })
  const mutationDependencies = input.createMutationDependencies()
  const dryRun = await runProgramVerificationBackfillDryRun({
    programIds,
    readRepository: input.readRepository,
    scoringVersion: input.scoringVersion,
  })
  if (dryRun.programs.some((program) => program.status !== "completed")) {
    throw new ProgramBackfillValidationError("Write preflight contains drift or failed programs.")
  }

  const context = await loadBatchReadContext(programIds, input.readRepository)
  const evidence: InsertOrVerifyResult<ProgramEvidenceSourceCandidate>[] = []
  const observations: InsertOrVerifyResult<ProgramFactObservationCandidate>[] = []
  const snapshots: InsertOrVerifyResult<ProgramQualityScoreCandidate>[] = []
  const dimensionScores: InsertOrVerifyResult<ProgramQualityDimensionScoreCandidate>[] = []

  for (const programId of programIds) {
    const mapped = mapProgramContext(programId, context)
    for (const candidate of mapped.evidence) {
      evidence.push(await insertOrVerifyEvidence({ expected: candidate, adapter: mutationDependencies.evidenceAdapter }))
    }
    for (const candidate of mapped.observations) {
      observations.push(await insertOrVerifyObservation({ expected: candidate, adapter: mutationDependencies.observationAdapter }))
    }
    const shadow = buildProgramShadowCalculationPlan({
      programId,
      scoringVersion: input.scoringVersion,
      evidence: mapped.evidence,
      observations: mapped.observations,
    })
    snapshots.push(await insertOrVerifyShadowSnapshot({ expected: shadow.expectedSnapshot, adapter: mutationDependencies.snapshotAdapter }))
    for (const candidate of shadow.expectedDimensionScores) {
      dimensionScores.push(await insertOrVerifyDimensionScore({ expected: candidate, adapter: mutationDependencies.dimensionScoreAdapter }))
    }
  }

  return { dryRun, evidence, observations, snapshots, dimensionScores }
}

async function loadBatchReadContext(
  programIds: readonly string[],
  readRepository: ProgramVerificationBackfillReadRepository,
): Promise<BatchReadContext> {
  const [programRows, verificationRows] = await Promise.all([
    readRepository.loadProgramsForBackfill(programIds),
    readRepository.loadLegacyProgramVerificationsByProgramIds(programIds),
  ])
  const sortedPrograms = [...programRows].sort((left, right) => compareCodeUnits(left.id, right.id))
  const sortedVerifications = [...verificationRows].sort(compareLegacyVerifications)
  const verificationsByProgramId = new Map<string, LegacyProgramVerificationRow[]>()
  for (const verification of sortedVerifications) {
    const rows = verificationsByProgramId.get(verification.program_id) ?? []
    rows.push(verification)
    verificationsByProgramId.set(verification.program_id, rows)
  }
  return {
    programIds,
    programsById: new Map(sortedPrograms.map((program) => [program.id, program])),
    verificationsByProgramId,
    backfillRunId: backfillRunId({
      backfillVersion: LEGACY_VERIFICATION_BACKFILL_VERSION,
      mapperVersion: LEGACY_VERIFICATION_MAPPER_VERSION,
      programIds,
      legacyVerificationIds: sortedVerifications.map((verification) => verification.id),
    }),
  }
}

async function planProgramDryRun(input: {
  readonly programId: string
  readonly context: BatchReadContext
  readonly readRepository: ProgramVerificationBackfillReadRepository
  readonly scoringVersion: ProgramQualityScoringVersion
}): Promise<ProgramBackfillDryRunResult> {
  const program = input.context.programsById.get(input.programId)
  const verifications = input.context.verificationsByProgramId.get(input.programId) ?? []
  if (program === undefined) return failedProgram(input.programId, input.programId, verifications.length, "program_not_found")
  const name = programName(program, input.programId)
  if (verifications.length === 0) return failedProgram(input.programId, name, 0, "legacy_verification_not_found")

  try {
    const mapped = mapProgramContext(input.programId, input.context)
    const [existingEvidence, existingObservations] = await Promise.all([
      input.readRepository.findExistingEvidenceByIds(mapped.evidence.map((candidate) => candidate.id)),
      input.readRepository.findExistingObservationsByIds(mapped.observations.map((candidate) => candidate.id)),
    ])
    const evidencePlan = planEvidence(mapped.evidence, existingEvidence)
    const observationPlan = planObservations(mapped.observations, existingObservations)
    const provisionalShadow = buildProgramShadowCalculationPlan({
      programId: input.programId,
      scoringVersion: input.scoringVersion,
      evidence: mapped.evidence,
      observations: mapped.observations,
    })
    const [existingSnapshots, existingDimensionScores] = await Promise.all([
      input.readRepository.findExistingQualitySnapshotsByIds([provisionalShadow.snapshotId]),
      input.readRepository.findExistingDimensionScoresByIds(provisionalShadow.expectedDimensionScores.map((score) => score.id)),
    ])
    const existingSnapshot = existingSnapshots.find((snapshot) => snapshot.id === provisionalShadow.snapshotId) ?? null
    const shadow = buildProgramShadowCalculationPlan({
      programId: input.programId,
      scoringVersion: input.scoringVersion,
      evidence: mapped.evidence,
      observations: mapped.observations,
      existingSnapshot,
      existingDimensionScores,
    })
    const hasDrift = evidencePlan.drift > 0 || observationPlan.drift > 0 || shadow.action === "drift"
    return {
      programId: input.programId,
      programName: name,
      status: hasDrift ? "partial" : "completed",
      legacyVerificationCount: mapped.verifications.length,
      evidencePlan,
      observationPlan,
      scoringEligibleFactCount: shadow.scoringEligibleFactCount,
      dimensionInputCount: shadow.dimensionInputs.length,
      shadowPlan: {
        action: shadow.action,
        snapshotId: shadow.snapshotId,
        inputHash: shadow.inputHash,
        overallQualityScore: shadow.overallQualityScore,
        evidenceConfidence: shadow.evidenceConfidence,
        dimensionCoverageCount: shadow.dimensionCoverageCount,
        publicEligible: shadow.publicEligible,
        publicStatusLabel: shadow.publicStatusLabel,
        calculationReason: shadow.calculationReason,
      },
      unresolved: sortedUniqueStrings(mapped.mappings.flatMap((mapping) => mapping.unresolved)),
      warnings: sortedUniqueStrings(mapped.mappings.flatMap((mapping) => mapping.warnings)),
      errors: [],
    }
  } catch {
    return failedProgram(input.programId, name, verifications.length, "program_processing_failed")
  }
}

function mapProgramContext(programId: string, context: BatchReadContext): MappedProgramContext {
  const program = context.programsById.get(programId)
  if (program === undefined) throw new ProgramBackfillValidationError("Program row is missing.")
  const verifications = context.verificationsByProgramId.get(programId) ?? []
  if (verifications.length === 0) throw new ProgramBackfillValidationError("Legacy verification rows are missing.")
  const mappings = verifications.map((verification) => mapLegacyProgramVerification({
    verification,
    program,
    backfillRunId: context.backfillRunId,
  }))
  return {
    program,
    verifications,
    mappings,
    evidence: mappings.map((mapping) => toEvidenceCandidate(mapping.evidence)).sort(compareCandidateIds),
    observations: mappings.flatMap((mapping) => mapping.metadataObservations).sort(compareCandidateIds),
  }
}

function planEvidence(
  candidates: readonly ProgramEvidenceSourceCandidate[],
  existingRows: readonly ProgramEvidenceSource[],
): ProgramBackfillImmutablePlan {
  const existingById = new Map(existingRows.map((row) => [row.id, row]))
  return summarizeItems(candidates.map((candidate) => {
    const existing = existingById.get(candidate.id)
    if (existing === undefined) return { id: candidate.id, action: "create" as const }
    const equal = immutablePayloadsEqual(
      normalizeEvidenceImmutablePayload(existing),
      normalizeEvidenceImmutablePayload(candidate),
    )
    return { id: candidate.id, action: equal ? "reuse" as const : "drift" as const }
  }))
}

function planObservations(
  candidates: readonly ProgramFactObservationCandidate[],
  existingRows: readonly ProgramFactObservation[],
): ProgramBackfillImmutablePlan {
  const existingById = new Map(existingRows.map((row) => [row.id, row]))
  return summarizeItems(candidates.map((candidate) => {
    const existing = existingById.get(candidate.id)
    if (existing === undefined) return { id: candidate.id, action: "create" as const }
    const equal = immutablePayloadsEqual(
      normalizeObservationImmutablePayload(existing),
      normalizeObservationImmutablePayload(candidate),
    )
    return { id: candidate.id, action: equal ? "reuse" as const : "drift" as const }
  }))
}

function summarizeItems(items: readonly ProgramBackfillItemPlan[]): ProgramBackfillImmutablePlan {
  const sorted = [...items].sort((left, right) => compareCodeUnits(left.id, right.id))
  return {
    create: sorted.filter((item) => item.action === "create").length,
    reuse: sorted.filter((item) => item.action === "reuse").length,
    drift: sorted.filter((item) => item.action === "drift").length,
    items: sorted,
  }
}

function totalPrograms(programs: readonly ProgramBackfillDryRunResult[]): ProgramBackfillBatchDryRunResult["totals"] {
  return programs.reduce<ProgramBackfillBatchDryRunResult["totals"]>((totals, program) => ({
    programs: totals.programs + 1,
    legacyVerifications: totals.legacyVerifications + program.legacyVerificationCount,
    evidenceCreate: totals.evidenceCreate + program.evidencePlan.create,
    evidenceReuse: totals.evidenceReuse + program.evidencePlan.reuse,
    evidenceDrift: totals.evidenceDrift + program.evidencePlan.drift,
    observationCreate: totals.observationCreate + program.observationPlan.create,
    observationReuse: totals.observationReuse + program.observationPlan.reuse,
    observationDrift: totals.observationDrift + program.observationPlan.drift,
    scoringEligibleFacts: totals.scoringEligibleFacts + program.scoringEligibleFactCount,
    dimensionInputs: totals.dimensionInputs + program.dimensionInputCount,
    snapshotCreate: totals.snapshotCreate + (program.status !== "failed" && program.shadowPlan.action === "create" ? 1 : 0),
    snapshotReuse: totals.snapshotReuse + (program.status !== "failed" && program.shadowPlan.action === "reuse" ? 1 : 0),
    snapshotDrift: totals.snapshotDrift + (program.status !== "failed" && program.shadowPlan.action === "drift" ? 1 : 0),
  }), {
    programs: 0,
    legacyVerifications: 0,
    evidenceCreate: 0,
    evidenceReuse: 0,
    evidenceDrift: 0,
    observationCreate: 0,
    observationReuse: 0,
    observationDrift: 0,
    scoringEligibleFacts: 0,
    dimensionInputs: 0,
    snapshotCreate: 0,
    snapshotReuse: 0,
    snapshotDrift: 0,
  })
}

function failedProgram(
  programId: string,
  name: string,
  legacyVerificationCount: number,
  error: string,
): ProgramBackfillDryRunResult {
  return {
    programId,
    programName: name,
    status: "failed",
    legacyVerificationCount,
    evidencePlan: summarizeItems([]),
    observationPlan: summarizeItems([]),
    scoringEligibleFactCount: 0,
    dimensionInputCount: 0,
    shadowPlan: {
      action: "drift",
      snapshotId: "",
      inputHash: "",
      overallQualityScore: null,
      evidenceConfidence: 0,
      dimensionCoverageCount: 0,
      publicEligible: false,
      publicStatusLabel: "운영 정보 확인 중",
      calculationReason: "failed",
    },
    unresolved: [],
    warnings: [],
    errors: [error],
  }
}

function programName(program: BackfillProgramRow | undefined, fallback: string): string {
  return program?.name?.trim() || program?.title?.trim() || fallback
}

function sortedUniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareCodeUnits)
}

function compareLegacyVerifications(left: LegacyProgramVerification, right: LegacyProgramVerification): number {
  return compareCodeUnits(left.program_id, right.program_id) || compareCodeUnits(left.id, right.id)
}

function compareCandidateIds(left: { readonly id: string }, right: { readonly id: string }): number {
  return compareCodeUnits(left.id, right.id)
}

function toEvidenceCandidate(
  candidate: LegacyVerificationMappingResult["evidence"],
): ProgramEvidenceSourceCandidate {
  return {
    id: candidate.id,
    programId: candidate.programId,
    sourceType: candidate.sourceType,
    sourceUrl: candidate.sourceUrl,
    title: candidate.title,
    sourceDate: candidate.sourceDate,
    verificationStatus: candidate.verificationStatus,
    verifiedParticipation: candidate.verifiedParticipation,
    isIndependent: candidate.isIndependent,
    metadata: { ...candidate.metadata },
  }
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
