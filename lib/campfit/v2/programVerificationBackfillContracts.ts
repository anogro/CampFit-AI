import type { LegacyProgramVerification } from "@/lib/campfit/v2/programVerificationFactMapper"
import type {
  ProgramEvidenceSource,
  ProgramFactObservation,
  ProgramQualityDimensionScore,
  ProgramQualityScore,
} from "@/types/campfitProgramQuality"

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
