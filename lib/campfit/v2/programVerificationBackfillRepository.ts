import "server-only"

import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import type { LegacyProgramVerification } from "@/lib/campfit/v2/programVerificationFactMapper"
import {
  evidenceSourceTypes,
  evidenceVerificationStatuses,
  factExtractionMethods,
  factObservationStatuses,
  programQualityCalculationStatuses,
  programQualityDimensionKeys,
} from "@/types/campfitProgramQuality"
import type {
  ProgramEvidenceSource,
  ProgramFactObservation,
  ProgramQualityDimensionScore,
  ProgramQualityScore,
} from "@/types/campfitProgramQuality"

type SupabaseClient = NonNullable<ReturnType<typeof createServerSupabaseClient>>

export type LegacyProgramVerificationRow = LegacyProgramVerification & {
  readonly summary: string | null
}

export interface BackfillProgramRow {
  readonly id: string
  readonly name: string | null
  readonly title: string | null
}

export interface ProgramQualityTableCounts {
  readonly programEvidenceSources: number
  readonly programFactObservations: number
  readonly programQualityScores: number
  readonly programQualityDimensionScores: number
  readonly programCriticalRiskFlags: number
}

export interface BackfillProgramQualityScore extends ProgramQualityScore {
  readonly id: string
}

export interface BackfillProgramQualityDimensionScore extends ProgramQualityDimensionScore {
  readonly id: string
  readonly programQualityScoreId: string
  readonly programId: string
}

export interface ProgramVerificationBackfillReadRepository {
  readonly loadLegacyProgramVerificationsByProgramIds: (
    programIds: readonly string[],
  ) => Promise<LegacyProgramVerificationRow[]>
  readonly loadProgramsForBackfill: (
    programIds: readonly string[],
  ) => Promise<BackfillProgramRow[]>
  readonly countQualityRowsExact: () => Promise<ProgramQualityTableCounts>
  readonly findExistingEvidenceByIds: (
    ids: readonly string[],
  ) => Promise<ProgramEvidenceSource[]>
  readonly findExistingObservationsByIds: (
    ids: readonly string[],
  ) => Promise<ProgramFactObservation[]>
  readonly findExistingQualitySnapshotsByIds: (
    ids: readonly string[],
  ) => Promise<BackfillProgramQualityScore[]>
  readonly findExistingDimensionScoresByIds: (
    ids: readonly string[],
  ) => Promise<BackfillProgramQualityDimensionScore[]>
}

export type BackfillReadTable =
  | "program_verifications"
  | "programs"
  | "program_evidence_sources"
  | "program_fact_observations"
  | "program_quality_scores"
  | "program_quality_dimension_scores"
  | "program_critical_risk_flags"

export type BackfillReadRequest =
  | {
    readonly kind: "rows"
    readonly table: BackfillReadTable
    readonly columns: string
    readonly filterColumn: "id" | "program_id"
    readonly ids: readonly string[]
    readonly orderBy: readonly string[]
  }
  | {
    readonly kind: "count"
    readonly table: BackfillReadTable
    readonly columns: "id"
    readonly count: "exact"
    readonly head: true
  }

export interface SafeSupabaseReadError {
  readonly code?: string
  readonly message: string
  readonly details?: string
  readonly hint?: string
}

export interface BackfillReadResponse {
  readonly data: unknown
  readonly count?: number | null
  readonly error: unknown | null
}

export interface BackfillReadExecutor {
  readonly execute: (request: BackfillReadRequest) => Promise<BackfillReadResponse>
}

export interface BackfillProgramLinkWarning {
  readonly code: "legacy_verification_program_missing"
  readonly programId: string
  readonly verificationId: string
}

export class ProgramVerificationBackfillReadError extends Error {
  readonly operation: string
  readonly code: string | null

  constructor(operation: string, code: string | null) {
    super("Quality backfill read failed.")
    this.name = "ProgramVerificationBackfillReadError"
    this.operation = operation
    this.code = code
  }
}

const LEGACY_VERIFICATION_COLUMNS = [
  "id",
  "program_id",
  "operator_verified",
  "facility_verified",
  "curriculum_verified",
  "refund_verified",
  "safety_verified",
  "accommodation_verified",
  "risk_labels",
  "notes",
  "summary",
  "verified_at",
  "created_at",
].join(",")

const EVIDENCE_COLUMNS = [
  "id", "program_id", "source_type", "source_url", "storage_path", "title", "source_date",
  "collected_at", "valid_until", "verification_status", "verified_participation", "is_independent",
  "canonical_url", "content_hash", "metadata", "created_at", "updated_at",
].join(",")

const OBSERVATION_COLUMNS = [
  "id", "program_id", "evidence_source_id", "provider_claim_id", "dimension_key", "fact_key",
  "fact_value", "normalized_numeric_value", "unit", "observation_status", "observation_confidence",
  "observed_at", "valid_until", "extraction_method", "created_at", "updated_at",
].join(",")

const QUALITY_SNAPSHOT_COLUMNS = [
  "id", "program_id", "scoring_version_id", "calculation_status", "overall_quality_score",
  "evidence_confidence", "confidence_label", "dimension_coverage_count", "independent_source_count",
  "critical_risk_count", "public_eligible", "public_status_label", "data_gaps", "calculation_summary",
  "calculated_at", "created_at",
].join(",")

const DIMENSION_SCORE_COLUMNS = [
  "id", "program_quality_score_id", "program_id", "dimension_key", "prior_score", "observed_score",
  "adjusted_score", "dimension_confidence", "evidence_count", "independent_source_count", "data_gaps",
  "explanation", "created_at",
].join(",")

const legacyValueSchema = z.union([z.enum(["complete", "partial", "missing"]), z.boolean(), z.null()])
const legacyVerificationSchema = z.object({
  id: z.string(),
  program_id: z.string(),
  operator_verified: legacyValueSchema,
  facility_verified: legacyValueSchema,
  curriculum_verified: legacyValueSchema,
  refund_verified: legacyValueSchema,
  safety_verified: legacyValueSchema,
  accommodation_verified: legacyValueSchema,
  risk_labels: z.array(z.string()).nullable(),
  notes: z.array(z.string()).nullable(),
  summary: z.string().nullable(),
  verified_at: z.string().nullable(),
  created_at: z.string(),
})
const programSchema = z.object({ id: z.string(), name: z.string().nullable(), title: z.string().nullable() })
const evidenceSchema = z.object({
  id: z.string(), program_id: z.string(), source_type: z.enum(evidenceSourceTypes), source_url: z.string().nullable(),
  storage_path: z.string().nullable(), title: z.string().nullable(), source_date: z.string().nullable(),
  collected_at: z.string(), valid_until: z.string().nullable(), verification_status: z.enum(evidenceVerificationStatuses),
  verified_participation: z.boolean(), is_independent: z.boolean(), canonical_url: z.string().nullable(),
  content_hash: z.string().nullable(), metadata: z.record(z.string(), z.unknown()), created_at: z.string(), updated_at: z.string(),
})
const observationSchema = z.object({
  id: z.string(), program_id: z.string(), evidence_source_id: z.string(), provider_claim_id: z.string().nullable(),
  dimension_key: z.enum(programQualityDimensionKeys), fact_key: z.string(), fact_value: z.unknown(),
  normalized_numeric_value: z.number().nullable(), unit: z.string().nullable(),
  observation_status: z.enum(factObservationStatuses), observation_confidence: z.number(),
  observed_at: z.string().nullable(), valid_until: z.string().nullable(), extraction_method: z.enum(factExtractionMethods),
  created_at: z.string(), updated_at: z.string(),
})
const publicStatusLabelSchema = z.enum([
  "운영 정보 확인 중",
  "근거 보통 · 참고용",
  "근거 충분",
  "추천 보류 · 추가 확인 필요",
])
const qualitySnapshotSchema = z.object({
  id: z.string(), program_id: z.string(), scoring_version_id: z.string(),
  calculation_status: z.enum(programQualityCalculationStatuses), overall_quality_score: z.number().nullable(),
  evidence_confidence: z.number(), confidence_label: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  dimension_coverage_count: z.number(), independent_source_count: z.number(), critical_risk_count: z.number(),
  public_eligible: z.boolean(), public_status_label: publicStatusLabelSchema, data_gaps: z.array(z.string()),
  calculation_summary: z.record(z.string(), z.unknown()), calculated_at: z.string(), created_at: z.string(),
})
const dimensionScoreSchema = z.object({
  id: z.string(), program_quality_score_id: z.string(), program_id: z.string(),
  dimension_key: z.enum(programQualityDimensionKeys), prior_score: z.number(), observed_score: z.number().nullable(),
  adjusted_score: z.number().nullable(), dimension_confidence: z.number(), evidence_count: z.number(),
  independent_source_count: z.number(), data_gaps: z.array(z.string()),
  explanation: z.record(z.string(), z.unknown()), created_at: z.string(),
})

export function createProgramVerificationBackfillReadRepository(
  executor: BackfillReadExecutor,
): ProgramVerificationBackfillReadRepository {
  return {
    loadLegacyProgramVerificationsByProgramIds: async (programIds) => {
      const ids = normalizeIds(programIds)
      if (ids.length === 0) return []
      const rows = await executeRows(executor, {
        kind: "rows", table: "program_verifications", columns: LEGACY_VERIFICATION_COLUMNS,
        filterColumn: "program_id", ids, orderBy: ["program_id", "id"],
      }, legacyVerificationSchema, "legacy verification load")
      return sortByProgramAndId(rows, (row) => row.program_id, (row) => row.id)
    },

    loadProgramsForBackfill: async (programIds) => {
      const ids = normalizeIds(programIds)
      if (ids.length === 0) return []
      const rows = await executeRows(executor, {
        kind: "rows", table: "programs", columns: "id,name,title", filterColumn: "id", ids, orderBy: ["id"],
      }, programSchema, "program load")
      return [...rows].sort((left, right) => compareCodeUnits(left.id, right.id))
    },

    countQualityRowsExact: async () => {
      const [programEvidenceSources, programFactObservations, programQualityScores, programQualityDimensionScores, programCriticalRiskFlags] = await Promise.all([
        readExactCount(executor, "program_evidence_sources"),
        readExactCount(executor, "program_fact_observations"),
        readExactCount(executor, "program_quality_scores"),
        readExactCount(executor, "program_quality_dimension_scores"),
        readExactCount(executor, "program_critical_risk_flags"),
      ])
      return { programEvidenceSources, programFactObservations, programQualityScores, programQualityDimensionScores, programCriticalRiskFlags }
    },

    findExistingEvidenceByIds: async (candidateIds) => {
      const ids = normalizeIds(candidateIds)
      if (ids.length === 0) return []
      const rows = await executeRows(executor, {
        kind: "rows", table: "program_evidence_sources", columns: EVIDENCE_COLUMNS,
        filterColumn: "id", ids, orderBy: ["program_id", "id"],
      }, evidenceSchema, "evidence load")
      return sortByProgramAndId(rows.map(toEvidence), (row) => row.programId, (row) => row.id)
    },

    findExistingObservationsByIds: async (candidateIds) => {
      const ids = normalizeIds(candidateIds)
      if (ids.length === 0) return []
      const rows = await executeRows(executor, {
        kind: "rows", table: "program_fact_observations", columns: OBSERVATION_COLUMNS,
        filterColumn: "id", ids, orderBy: ["program_id", "id"],
      }, observationSchema, "observation load")
      return sortByProgramAndId(rows.map(toObservation), (row) => row.programId, (row) => row.id)
    },

    findExistingQualitySnapshotsByIds: async (candidateIds) => {
      const ids = normalizeIds(candidateIds)
      if (ids.length === 0) return []
      const rows = await executeRows(executor, {
        kind: "rows", table: "program_quality_scores", columns: QUALITY_SNAPSHOT_COLUMNS,
        filterColumn: "id", ids, orderBy: ["program_id", "id"],
      }, qualitySnapshotSchema, "quality snapshot load")
      return sortByProgramAndId(rows.map(toQualitySnapshot), (row) => row.programId, (row) => row.id)
    },

    findExistingDimensionScoresByIds: async (candidateIds) => {
      const ids = normalizeIds(candidateIds)
      if (ids.length === 0) return []
      const rows = await executeRows(executor, {
        kind: "rows", table: "program_quality_dimension_scores", columns: DIMENSION_SCORE_COLUMNS,
        filterColumn: "id", ids, orderBy: ["program_id", "id"],
      }, dimensionScoreSchema, "dimension score load")
      return sortByProgramAndId(rows.map(toDimensionScore), (row) => row.programId, (row) => row.id)
    },
  }
}

export function createSupabaseProgramVerificationBackfillReadRepository(): ProgramVerificationBackfillReadRepository | null {
  const client = createServerSupabaseClient()
  if (client === null) return null
  return createProgramVerificationBackfillReadRepository(createSupabaseReadExecutor(client))
}

export function findBackfillProgramLinkWarnings(
  verifications: readonly Pick<LegacyProgramVerificationRow, "id" | "program_id">[],
  programs: readonly Pick<BackfillProgramRow, "id">[],
): BackfillProgramLinkWarning[] {
  const programIds = new Set(programs.map((program) => program.id))
  return verifications
    .filter((verification) => !programIds.has(verification.program_id))
    .map(toBackfillProgramLinkWarning)
    .sort((left, right) => compareCodeUnits(left.programId, right.programId) || compareCodeUnits(left.verificationId, right.verificationId))
}

function createSupabaseReadExecutor(client: SupabaseClient): BackfillReadExecutor {
  return {
    execute: async (request) => {
      if (request.kind === "count") {
        const { data, count, error } = await client.from(request.table).select(request.columns, {
          count: request.count,
          head: request.head,
        })
        return { data, count, error }
      }

      let query = client.from(request.table).select(request.columns).in(request.filterColumn, request.ids)
      for (const column of request.orderBy) query = query.order(column, { ascending: true })
      const { data, error } = await query
      return { data, error }
    },
  }
}

async function executeRows<Schema extends z.ZodTypeAny>(
  executor: BackfillReadExecutor,
  request: Extract<BackfillReadRequest, { readonly kind: "rows" }>,
  schema: Schema,
  operation: string,
): Promise<z.infer<Schema>[]> {
  const response = await executor.execute(request)
  if (response.error !== null) failRead(operation, response.error)
  const parsed = z.array(schema).safeParse(response.data ?? [])
  if (!parsed.success) {
    failRead(operation, {
      code: "INVALID_ROW_SHAPE",
      message: "Database row did not match the expected backfill read shape.",
    })
  }
  return parsed.data
}

async function readExactCount(executor: BackfillReadExecutor, table: BackfillReadTable): Promise<number> {
  const response = await executor.execute({ kind: "count", table, columns: "id", count: "exact", head: true })
  if (response.error !== null) failRead(`${table} exact count`, response.error)
  if (typeof response.count !== "number" || !Number.isInteger(response.count) || response.count < 0) {
    failRead(`${table} exact count`, {
      code: "EXACT_COUNT_UNAVAILABLE",
      message: "Exact row count was unavailable.",
    })
  }
  return response.count
}

function failRead(operation: string, error: unknown): never {
  const safeError = {
    code: readStringProperty(error, "code"),
    message: readStringProperty(error, "message") ?? "Unknown Supabase read error.",
    details: readStringProperty(error, "details"),
    hint: readStringProperty(error, "hint"),
  }
  console.error("CampFit v2 quality backfill read failed", { operation, ...safeError })
  throw new ProgramVerificationBackfillReadError(operation, safeError.code ?? null)
}

function toEvidence(row: z.infer<typeof evidenceSchema>): ProgramEvidenceSource {
  return {
    id: row.id, programId: row.program_id, sourceType: row.source_type, collectedAt: row.collected_at,
    verificationStatus: row.verification_status, verifiedParticipation: row.verified_participation,
    isIndependent: row.is_independent, metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at,
    ...(row.source_url === null ? {} : { sourceUrl: row.source_url }),
    ...(row.storage_path === null ? {} : { storagePath: row.storage_path }),
    ...(row.title === null ? {} : { title: row.title }),
    ...(row.source_date === null ? {} : { sourceDate: row.source_date }),
    ...(row.valid_until === null ? {} : { validUntil: row.valid_until }),
    ...(row.canonical_url === null ? {} : { canonicalUrl: row.canonical_url }),
    ...(row.content_hash === null ? {} : { contentHash: row.content_hash }),
  }
}

function toObservation(row: z.infer<typeof observationSchema>): ProgramFactObservation {
  return {
    id: row.id, programId: row.program_id, evidenceSourceId: row.evidence_source_id,
    dimensionKey: row.dimension_key, factKey: row.fact_key, factValue: row.fact_value,
    observationStatus: row.observation_status, observationConfidence: row.observation_confidence,
    extractionMethod: row.extraction_method, createdAt: row.created_at, updatedAt: row.updated_at,
    ...(row.provider_claim_id === null ? {} : { providerClaimId: row.provider_claim_id }),
    ...(row.normalized_numeric_value === null ? {} : { normalizedNumericValue: row.normalized_numeric_value }),
    ...(row.unit === null ? {} : { unit: row.unit }),
    ...(row.observed_at === null ? {} : { observedAt: row.observed_at }),
    ...(row.valid_until === null ? {} : { validUntil: row.valid_until }),
  }
}

function toQualitySnapshot(row: z.infer<typeof qualitySnapshotSchema>): BackfillProgramQualityScore {
  return {
    id: row.id, programId: row.program_id, scoringVersionId: row.scoring_version_id,
    calculationStatus: row.calculation_status, evidenceConfidence: row.evidence_confidence,
    confidenceLabel: row.confidence_label, dimensionCoverageCount: row.dimension_coverage_count,
    independentSourceCount: row.independent_source_count, criticalRiskCount: row.critical_risk_count,
    publicEligible: row.public_eligible, publicStatusLabel: row.public_status_label, dataGaps: row.data_gaps,
    calculationSummary: row.calculation_summary, calculatedAt: row.calculated_at, createdAt: row.created_at,
    ...(row.overall_quality_score === null ? {} : { overallQualityScore: row.overall_quality_score }),
  }
}

function toDimensionScore(row: z.infer<typeof dimensionScoreSchema>): BackfillProgramQualityDimensionScore {
  return {
    id: row.id, programQualityScoreId: row.program_quality_score_id, programId: row.program_id,
    dimensionKey: row.dimension_key, priorScore: row.prior_score, dimensionConfidence: row.dimension_confidence,
    evidenceCount: row.evidence_count, independentSourceCount: row.independent_source_count,
    dataGaps: row.data_gaps, explanation: row.explanation,
    ...(row.observed_score === null ? {} : { observedScore: row.observed_score }),
    ...(row.adjusted_score === null ? {} : { adjustedScore: row.adjusted_score }),
  }
}

function normalizeIds(values: readonly string[]): readonly string[] {
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0)
  return [...new Set(normalized)].sort(compareCodeUnits)
}

function sortByProgramAndId<T>(
  rows: readonly T[],
  programId: (row: T) => string,
  id: (row: T) => string,
): T[] {
  return [...rows].sort((left, right) => (
    compareCodeUnits(programId(left), programId(right)) || compareCodeUnits(id(left), id(right))
  ))
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function toBackfillProgramLinkWarning(
  verification: Pick<LegacyProgramVerificationRow, "id" | "program_id">,
): BackfillProgramLinkWarning {
  return {
    code: "legacy_verification_program_missing",
    programId: verification.program_id,
    verificationId: verification.id,
  }
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const property = Reflect.get(value, key)
  return typeof property === "string" ? property : undefined
}
