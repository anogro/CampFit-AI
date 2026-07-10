import "server-only"

import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import { parseRows, toCriticalRisk, toDimensionInput, toEvidenceSource } from "@/lib/campfit/v2/programQualityRepositoryMappers"
import { createShadowProgramQualityScoringVersion } from "@/lib/campfit/v2/programQualityScorer"
import { ProgramQualityScoringVersionSchema } from "@/lib/campfit/v2/programQualitySchemas"
import type {
  ProgramEvidenceSource,
  ProgramFactObservation,
  ProgramProviderClaim,
  ProgramQualityCalculationInput,
  ProgramQualityCalculationResult,
  ProgramQualityScoringVersion,
} from "@/types/campfitProgramQuality"

type SupabaseClient = NonNullable<ReturnType<typeof createServerSupabaseClient>>

const rowSchema = z.record(z.string(), z.unknown())

export async function loadActiveScoringVersion(): Promise<ProgramQualityScoringVersion | null> {
  const client = createServerSupabaseClient()
  if (client === null) return null
  const { data, error } = await client
    .from("program_quality_scoring_versions")
    .select("id, version_key, description, status, prior_score, confidence_weights, dimension_weights, public_visibility_rules, rule_config, created_at, activated_at, retired_at")
    .in("status", ["shadow", "active"])
    .order("activated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error !== null) return logSupabaseError("quality scoring version load", error)
  const parsed = rowSchema.safeParse(data)
  if (!parsed.success) return null
  return toScoringVersion(parsed.data)
}

export async function insertProviderClaim(claim: ProgramProviderClaim): Promise<string | null> {
  const client = createServerSupabaseClient()
  if (client === null) return null
  const { data, error } = await client.from("program_provider_claims").insert({
    program_id: claim.programId,
    provider_partner_id: claim.providerPartnerId ?? null,
    submitted_by_user_id: claim.submittedByUserId ?? null,
    claim_key: claim.claimKey,
    claim_value: claim.claimValue,
    unit: claim.unit ?? null,
    claim_status: claim.claimStatus,
    valid_from: claim.validFrom ?? null,
    valid_until: claim.validUntil ?? null,
  }).select("id").maybeSingle()
  if (error !== null) return logSupabaseError("provider claim insert", error)
  return readString(rowSchema.safeParse(data), "id")
}

export async function insertEvidenceSource(source: ProgramEvidenceSource): Promise<string | null> {
  const client = createServerSupabaseClient()
  if (client === null) return null
  const { data, error } = await client.from("program_evidence_sources").insert({
    program_id: source.programId, source_type: source.sourceType, source_url: source.sourceUrl ?? null,
    storage_path: source.storagePath ?? null, title: source.title ?? null, source_date: source.sourceDate ?? null,
    collected_at: source.collectedAt, valid_until: source.validUntil ?? null,
    verification_status: source.verificationStatus, verified_participation: source.verifiedParticipation,
    is_independent: source.isIndependent, canonical_url: source.canonicalUrl ?? null,
    content_hash: source.contentHash ?? null, metadata: source.metadata,
    created_by_user_id: source.createdByUserId ?? null,
  }).select("id").maybeSingle()
  if (error !== null) return logSupabaseError("evidence source insert", error)
  return readString(rowSchema.safeParse(data), "id")
}

export async function insertFactObservation(observation: ProgramFactObservation): Promise<string | null> {
  const client = createServerSupabaseClient()
  if (client === null) return null
  const { data, error } = await client.from("program_fact_observations").insert({
    program_id: observation.programId, evidence_source_id: observation.evidenceSourceId,
    provider_claim_id: observation.providerClaimId ?? null, dimension_key: observation.dimensionKey,
    fact_key: observation.factKey, fact_value: observation.factValue,
    normalized_numeric_value: observation.normalizedNumericValue ?? null, unit: observation.unit ?? null,
    observation_status: observation.observationStatus, observation_confidence: observation.observationConfidence,
    observed_at: observation.observedAt ?? null, valid_until: observation.validUntil ?? null,
    extraction_method: observation.extractionMethod,
  }).select("id").maybeSingle()
  if (error !== null) return logSupabaseError("fact observation insert", error)
  return readString(rowSchema.safeParse(data), "id")
}

export async function loadProgramQualityCalculationInput(programId: string): Promise<ProgramQualityCalculationInput | null> {
  const client = createServerSupabaseClient()
  const scoringVersion = await loadActiveScoringVersion()
  if (client === null || scoringVersion === null) return null
  const [{ data: sourceData, error: sourceError }, { data: factData, error: factError }, risks] = await Promise.all([
    client.from("program_evidence_sources").select("*").eq("program_id", programId).eq("verification_status", "verified"),
    client.from("program_fact_observations").select("*").eq("program_id", programId).in("observation_status", ["extracted", "verified"]),
    loadActiveCriticalRisks(programId),
  ])
  if (sourceError !== null || factError !== null) {
    if (sourceError !== null) logSupabaseError("quality evidence load", sourceError)
    if (factError !== null) logSupabaseError("quality fact load", factError)
    return null
  }
  const sources = parseRows(sourceData).flatMap(toEvidenceSource)
  const dimensions = parseRows(factData).flatMap(toDimensionInput)
  return { programId, scoringVersion, evidenceSources: sources, dimensions, criticalRisks: risks, agreementScore: 50, calculatedAt: new Date().toISOString() }
}

export async function saveProgramQualitySnapshot(result: ProgramQualityCalculationResult): Promise<string | null> {
  const client = createServerSupabaseClient()
  if (client === null) return null
  const score = result.qualityScore
  const { data, error } = await client.from("program_quality_scores").insert({
    program_id: score.programId, scoring_version_id: score.scoringVersionId, calculation_status: score.calculationStatus,
    overall_quality_score: score.overallQualityScore ?? null, evidence_confidence: score.evidenceConfidence,
    confidence_label: score.confidenceLabel, dimension_coverage_count: score.dimensionCoverageCount,
    independent_source_count: score.independentSourceCount, critical_risk_count: score.criticalRiskCount,
    public_eligible: score.publicEligible, public_status_label: score.publicStatusLabel,
    data_gaps: score.dataGaps, calculation_summary: score.calculationSummary, calculated_at: score.calculatedAt,
  }).select("id").maybeSingle()
  if (error !== null) return logSupabaseError("quality snapshot insert", error)
  const snapshotId = readString(rowSchema.safeParse(data), "id")
  if (snapshotId === null) return null
  const dimensions = result.dimensionScores.map((dimension) => ({
    program_quality_score_id: snapshotId, program_id: score.programId, dimension_key: dimension.dimensionKey,
    prior_score: dimension.priorScore, observed_score: dimension.observedScore ?? null,
    adjusted_score: dimension.adjustedScore ?? null, dimension_confidence: dimension.dimensionConfidence,
    evidence_count: dimension.evidenceCount, independent_source_count: dimension.independentSourceCount,
    data_gaps: dimension.dataGaps, explanation: dimension.explanation,
  }))
  const { error: dimensionError } = await client.from("program_quality_dimension_scores").insert(dimensions)
  if (dimensionError !== null) return logSupabaseError("dimension snapshot insert", dimensionError)
  await supersedePreviousQualitySnapshots(score.programId, score.scoringVersionId, snapshotId)
  return snapshotId
}

export async function supersedePreviousQualitySnapshots(programId: string, versionId: string, retainedSnapshotId?: string): Promise<void> {
  const client = createServerSupabaseClient()
  if (client === null) return
  let query = client.from("program_quality_scores").update({ calculation_status: "superseded" })
    .eq("program_id", programId).eq("scoring_version_id", versionId).in("calculation_status", ["shadow", "published"])
  if (retainedSnapshotId !== undefined) query = query.neq("id", retainedSnapshotId)
  const { error } = await query
  if (error !== null) logSupabaseError("quality snapshot supersede", error)
}

export async function loadLatestProgramQualitySummary(programIds: readonly string[]) {
  const client = createServerSupabaseClient()
  if (client === null || programIds.length === 0) return []
  const { data, error } = await client.from("program_quality_scores").select("*").in("program_id", programIds)
    .in("calculation_status", ["shadow", "published"]).order("calculated_at", { ascending: false })
  if (error !== null) return logSupabaseError("quality summary load", error, [])
  return parseRows(data)
}

export async function loadActiveCriticalRisks(programId: string) {
  const client = createServerSupabaseClient()
  if (client === null) return []
  const { data, error } = await client.from("program_critical_risk_flags").select("*").eq("program_id", programId)
    .in("status", ["under_review", "confirmed"])
  if (error !== null) {
    logSupabaseError("critical risk load", error)
    return []
  }
  return parseRows(data).flatMap(toCriticalRisk)
}

function toScoringVersion(row: Record<string, unknown>): ProgramQualityScoringVersion | null {
  const fallback = createShadowProgramQualityScoringVersion()
  const id = readString(rowSchema.safeParse(row), "id")
  const versionKey = readString(rowSchema.safeParse(row), "version_key")
  const status = readString(rowSchema.safeParse(row), "status")
  const createdAt = readString(rowSchema.safeParse(row), "created_at")
  if (id === null || versionKey === null || createdAt === null || (status !== "shadow" && status !== "active")) return null
  const sourceAuthorityWeights = z.record(z.string(), z.number()).safeParse(recordValue(row, "rule_config")["sourceAuthorityWeights"])
  const parsed = ProgramQualityScoringVersionSchema.safeParse({
    ...fallback,
    id,
    versionKey,
    status,
    priorScore: row["prior_score"],
    confidenceWeights: row["confidence_weights"],
    dimensionWeights: row["dimension_weights"],
    sourceAuthorityWeights: sourceAuthorityWeights.success ? sourceAuthorityWeights.data : fallback.sourceAuthorityWeights,
    publicVisibilityRules: row["public_visibility_rules"],
    ruleConfig: withoutSourceAuthorityWeights(recordValue(row, "rule_config")),
    createdAt,
    ...(readOptionalString(row, "activated_at", "activatedAt")),
    ...(readOptionalString(row, "retired_at", "retiredAt")),
  })
  if (!parsed.success) return null
  return {
    id: parsed.data.id,
    versionKey: parsed.data.versionKey,
    ...(parsed.data.description === undefined ? {} : { description: parsed.data.description }),
    status: parsed.data.status,
    priorScore: parsed.data.priorScore,
    confidenceWeights: parsed.data.confidenceWeights,
    dimensionWeights: parsed.data.dimensionWeights,
    sourceAuthorityWeights: parsed.data.sourceAuthorityWeights,
    publicVisibilityRules: parsed.data.publicVisibilityRules,
    ruleConfig: parsed.data.ruleConfig,
    createdAt: parsed.data.createdAt,
    ...(parsed.data.activatedAt === undefined ? {} : { activatedAt: parsed.data.activatedAt }),
    ...(parsed.data.retiredAt === undefined ? {} : { retiredAt: parsed.data.retiredAt }),
  }
}

function readString(result: z.SafeParseReturnType<unknown, Record<string, unknown>>, key: string): string | null { return result.success && typeof result.data[key] === "string" ? result.data[key] : null }
function logSupabaseError<T>(operation: string, error: { readonly code?: string; readonly message: string; readonly details?: string; readonly hint?: string }, fallback: T | null = null): T | null { console.error(`CampFit v2 ${operation} failed`, { code: error.code, message: error.message, details: error.details, hint: error.hint }); return fallback }
function recordValue(row: Record<string, unknown>, key: string): Record<string, unknown> { const parsed = rowSchema.safeParse(row[key]); return parsed.success ? parsed.data : {} }
function withoutSourceAuthorityWeights(config: Record<string, unknown>): Record<string, unknown> { const { sourceAuthorityWeights: _sourceAuthorityWeights, ...ruleConfig } = config; return ruleConfig }
function readOptionalString(row: Record<string, unknown>, sourceKey: string, outputKey: string): Readonly<Record<string, string>> { return typeof row[sourceKey] === "string" ? { [outputKey]: row[sourceKey] } : {} }
