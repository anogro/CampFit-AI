import { z } from "zod"
import {
  criticalRiskSeverities,
  criticalRiskStatuses,
  evidenceSourceTypes,
  evidenceVerificationStatuses,
  factExtractionMethods,
  factObservationStatuses,
  programQualityDimensionKeys,
} from "@/types/campfitProgramQuality"
import type {
  ProgramCriticalRiskFlag,
  ProgramEvidenceSource,
  ProgramQualityDimensionInput,
} from "@/types/campfitProgramQuality"

const rowSchema = z.record(z.string(), z.unknown())
const metadataSchema = z.record(z.string(), z.unknown())

export function toEvidenceSource(row: Record<string, unknown>): ProgramEvidenceSource[] {
  const id = stringValue(row, "id")
  const programId = stringValue(row, "program_id")
  const sourceType = enumValue(row, "source_type", evidenceSourceTypes)
  const verificationStatus = enumValue(row, "verification_status", evidenceVerificationStatuses)
  const collectedAt = stringValue(row, "collected_at")
  if (id === null || programId === null || sourceType === null || verificationStatus === null || collectedAt === null) return []
  return [{
    id, programId, sourceType, verificationStatus, collectedAt,
    verifiedParticipation: booleanValue(row, "verified_participation") ?? false,
    isIndependent: booleanValue(row, "is_independent") ?? false,
    metadata: recordValue(row, "metadata"),
    ...optionalString(row, "source_url", "sourceUrl"),
    ...optionalString(row, "storage_path", "storagePath"),
    ...optionalString(row, "title", "title"),
    ...optionalString(row, "source_date", "sourceDate"),
    ...optionalString(row, "valid_until", "validUntil"),
    ...optionalString(row, "canonical_url", "canonicalUrl"),
    ...optionalString(row, "content_hash", "contentHash"),
    ...optionalString(row, "created_by_user_id", "createdByUserId"),
  }]
}

export function toDimensionInput(row: Record<string, unknown>): ProgramQualityDimensionInput[] {
  const dimensionKey = enumValue(row, "dimension_key", programQualityDimensionKeys)
  const observedScore = numberValue(row, "normalized_numeric_value")
  if (dimensionKey === null || observedScore === null) return []
  return [{ dimensionKey, observedScore, dataGaps: [] }]
}

export function toCriticalRisk(row: Record<string, unknown>): ProgramCriticalRiskFlag[] {
  const id = stringValue(row, "id")
  const programId = stringValue(row, "program_id")
  const severity = enumValue(row, "severity", criticalRiskSeverities)
  const status = enumValue(row, "status", criticalRiskStatuses)
  const internalSummary = stringValue(row, "internal_summary")
  const detectedAt = stringValue(row, "detected_at")
  if (id === null || programId === null || severity === null || status === null || internalSummary === null || detectedAt === null) return []
  return [{
    id, programId, severity, status, internalSummary, detectedAt, metadata: recordValue(row, "metadata"),
    ...optionalString(row, "evidence_source_id", "evidenceSourceId"),
    ...optionalString(row, "risk_key", "riskKey"),
    ...optionalString(row, "public_summary", "publicSummary"),
    ...optionalString(row, "confirmed_at", "confirmedAt"),
    ...optionalString(row, "resolved_at", "resolvedAt"),
    ...optionalString(row, "reviewed_by_user_id", "reviewedByUserId"),
    ...optionalString(row, "resolution_note", "resolutionNote"),
  }]
}

function stringValue(row: Record<string, unknown>, key: string): string | null { return typeof row[key] === "string" ? row[key] : null }
function numberValue(row: Record<string, unknown>, key: string): number | null { return typeof row[key] === "number" && Number.isFinite(row[key]) ? row[key] : null }
function booleanValue(row: Record<string, unknown>, key: string): boolean | null { return typeof row[key] === "boolean" ? row[key] : null }
function recordValue(row: Record<string, unknown>, key: string): Readonly<Record<string, unknown>> { const parsed = metadataSchema.safeParse(row[key]); return parsed.success ? parsed.data : {} }
function optionalString(row: Record<string, unknown>, sourceKey: string, outputKey: string): Readonly<Record<string, string>> { const value = stringValue(row, sourceKey); return value === null ? {} : { [outputKey]: value } }
function enumValue<const T extends readonly string[]>(row: Record<string, unknown>, key: string, values: T): T[number] | null { const value = stringValue(row, key); return value !== null && values.some((candidate) => candidate === value) ? value : null }
export function parseRows(data: unknown): readonly Record<string, unknown>[] { const parsed = z.array(rowSchema).safeParse(data ?? []); return parsed.success ? parsed.data : [] }
