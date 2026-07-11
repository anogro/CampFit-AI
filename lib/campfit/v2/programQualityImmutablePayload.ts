import {
  shadowSnapshotId,
  stableCanonicalJson,
} from "@/lib/campfit/v2/programQualityBackfillIdentity"
import type {
  EvidenceSourceType,
  EvidenceVerificationStatus,
  FactExtractionMethod,
  FactObservationStatus,
  ProgramEvidenceSource,
  ProgramFactObservation,
  ProgramQualityCalculationStatus,
  ProgramQualityDimensionKey,
  ProgramQualityDimensionScore,
  ProgramQualityScore,
} from "@/types/campfitProgramQuality"

export const BACKFILL_OWNED_EVIDENCE_METADATA_KEYS = [
  "legacyVerificationId",
  "legacyStatus",
  "sourceSystem",
  "backfillVersion",
  "mapperVersion",
  "firstBackfillRunId",
  "riskLabelCount",
  "manualReviewCandidate",
] as const

export interface ProgramEvidenceSourceCandidate {
  readonly id: string
  readonly programId: string
  readonly sourceType: EvidenceSourceType
  readonly sourceUrl?: string | null
  readonly storagePath?: string | null
  readonly title?: string | null
  readonly sourceDate?: string | null
  readonly validUntil?: string | null
  readonly verificationStatus: EvidenceVerificationStatus
  readonly verifiedParticipation: boolean
  readonly isIndependent: boolean
  readonly canonicalUrl?: string | null
  readonly contentHash?: string | null
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface ProgramFactObservationCandidate {
  readonly id: string
  readonly programId: string
  readonly evidenceSourceId: string
  readonly providerClaimId?: string | null
  readonly dimensionKey: ProgramQualityDimensionKey
  readonly factKey: string
  readonly factValue: unknown
  readonly normalizedNumericValue?: number | null
  readonly unit?: string | null
  readonly observationStatus: FactObservationStatus
  readonly observationConfidence: number
  readonly observedAt?: string | null
  readonly validUntil?: string | null
  readonly extractionMethod: FactExtractionMethod
}

export interface ProgramQualityScoreCandidate {
  readonly id: string
  readonly programId: string
  readonly scoringVersionId: string
  readonly calculationStatus: ProgramQualityCalculationStatus
  readonly overallQualityScore?: number | null
  readonly evidenceConfidence: number
  readonly confidenceLabel: ProgramQualityScore["confidenceLabel"]
  readonly dimensionCoverageCount: number
  readonly independentSourceCount: number
  readonly criticalRiskCount: number
  readonly publicEligible: boolean
  readonly publicStatusLabel: ProgramQualityScore["publicStatusLabel"]
  readonly dataGaps: readonly string[]
  readonly calculationSummary: Readonly<Record<string, unknown>>
}

export type ProgramQualityDimensionScoreCandidate = Omit<ProgramQualityDimensionScore, "observedScore" | "adjustedScore"> & {
  readonly id: string
  readonly programQualityScoreId: string
  readonly programId: string
  readonly observedScore?: number | null
  readonly adjustedScore?: number | null
}

export function normalizeEvidenceImmutablePayload(
  row: ProgramEvidenceSourceCandidate | ProgramEvidenceSource,
): unknown {
  return {
    id: row.id,
    programId: row.programId,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl ?? null,
    storagePath: row.storagePath ?? null,
    title: row.title ?? null,
    sourceDate: row.sourceDate ?? null,
    validUntil: row.validUntil ?? null,
    verificationStatus: row.verificationStatus,
    verifiedParticipation: row.verifiedParticipation,
    isIndependent: row.isIndependent,
    canonicalUrl: row.canonicalUrl ?? null,
    contentHash: row.contentHash ?? null,
    metadata: selectBackfillOwnedMetadata(row.metadata),
  }
}

export function normalizeObservationImmutablePayload(
  row: ProgramFactObservationCandidate | ProgramFactObservation,
): unknown {
  return {
    id: row.id,
    programId: row.programId,
    evidenceSourceId: row.evidenceSourceId,
    providerClaimId: row.providerClaimId ?? null,
    dimensionKey: row.dimensionKey,
    factKey: row.factKey,
    factValue: row.factValue,
    normalizedNumericValue: row.normalizedNumericValue ?? null,
    unit: row.unit ?? null,
    observationStatus: row.observationStatus,
    observationConfidence: row.observationConfidence,
    observedAt: row.observedAt ?? null,
    validUntil: row.validUntil ?? null,
    extractionMethod: row.extractionMethod,
  }
}

export function normalizeQualitySnapshotImmutablePayload(
  row: ProgramQualityScoreCandidate | ProgramQualityScore,
): unknown {
  return {
    ...optionalIdentity(row, "id"),
    programId: row.programId,
    scoringVersionId: row.scoringVersionId,
    calculationStatus: row.calculationStatus,
    overallQualityScore: row.overallQualityScore ?? null,
    evidenceConfidence: row.evidenceConfidence,
    confidenceLabel: row.confidenceLabel,
    dimensionCoverageCount: row.dimensionCoverageCount,
    independentSourceCount: row.independentSourceCount,
    criticalRiskCount: row.criticalRiskCount,
    publicEligible: row.publicEligible,
    publicStatusLabel: row.publicStatusLabel,
    dataGaps: sortedStrings(row.dataGaps),
    calculationSummary: row.calculationSummary,
  }
}

export function normalizeDimensionScoreImmutablePayload(
  row: ProgramQualityDimensionScoreCandidate | ProgramQualityDimensionScore,
): unknown {
  return {
    ...optionalIdentity(row, "id"),
    ...optionalIdentity(row, "programQualityScoreId"),
    ...optionalIdentity(row, "programId"),
    dimensionKey: row.dimensionKey,
    priorScore: row.priorScore,
    observedScore: row.observedScore ?? null,
    adjustedScore: row.adjustedScore ?? null,
    dimensionConfidence: row.dimensionConfidence,
    evidenceCount: row.evidenceCount,
    independentSourceCount: row.independentSourceCount,
    dataGaps: sortedStrings(row.dataGaps),
    explanation: row.explanation,
  }
}

export function immutablePayloadsEqual(left: unknown, right: unknown): boolean {
  return stableCanonicalJson(left) === stableCanonicalJson(right)
}

export function createNullShadowSnapshotCandidate(input: {
  readonly programId: string
  readonly scoringVersionId: string
  readonly inputHash: string
}): ProgramQualityScoreCandidate {
  const programId = requiredValue(input.programId, "programId")
  const scoringVersionId = requiredValue(input.scoringVersionId, "scoringVersionId")
  const inputHash = requiredValue(input.inputHash, "inputHash")
  return {
    id: shadowSnapshotId(programId, scoringVersionId, inputHash),
    programId,
    scoringVersionId,
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
    calculationSummary: {
      reason: "no_scoring_eligible_evidence",
      inputHash,
    },
  }
}

function selectBackfillOwnedMetadata(metadata: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const selected: Record<string, unknown> = {}
  for (const key of BACKFILL_OWNED_EVIDENCE_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) selected[key] = metadata[key]
  }
  return selected
}

function optionalIdentity(row: object, key: string): Readonly<Record<string, string>> {
  if (!(key in row)) return {}
  const value = Reflect.get(row, key)
  return typeof value === "string" ? { [key]: value } : {}
}

function sortedStrings(values: readonly string[]): readonly string[] {
  return [...values].sort(compareCodeUnits)
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function requiredValue(value: string, fieldName: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new TypeError(`${fieldName} must not be empty.`)
  return trimmed
}
