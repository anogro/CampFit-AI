import { qualityInputHash } from "@/lib/campfit/v2/programQualityBackfillIdentity"
import {
  aggregateDimensionSignals,
  isScoringEligibleObservation,
} from "@/lib/campfit/v2/programQualityFactAggregator"
import {
  createNullShadowSnapshotCandidate,
  immutablePayloadsEqual,
  normalizeQualitySnapshotImmutablePayload,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import type {
  ProgramEvidenceSourceCandidate,
  ProgramFactObservationCandidate,
  ProgramQualityDimensionScoreCandidate,
  ProgramQualityScoreCandidate,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import type {
  ProgramQualityDimensionInput,
  ProgramQualityDimensionScore,
  ProgramQualityScore,
  ProgramQualityScoringVersion,
} from "@/types/campfitProgramQuality"

export const PROGRAM_QUALITY_SHADOW_POLICY_VERSION = "quality-shadow-policy-v1" as const

export interface ProgramShadowCalculationPlan {
  readonly programId: string
  readonly scoringVersionId: string
  readonly inputHash: string
  readonly snapshotId: string
  readonly evidenceIds: readonly string[]
  readonly observationIds: readonly string[]
  readonly scoringEligibleFactCount: number
  readonly dimensionInputs: readonly ProgramQualityDimensionInput[]
  readonly evidenceConfidence: number
  readonly dimensionCoverageCount: number
  readonly independentSourceCount: number
  readonly overallQualityScore: number | null
  readonly publicEligible: boolean
  readonly publicStatusLabel: string
  readonly calculationReason: "no_scoring_eligible_evidence" | "calculated" | "failed"
  readonly expectedSnapshot: ProgramQualityScoreCandidate
  readonly expectedDimensionScores: readonly ProgramQualityDimensionScoreCandidate[]
  readonly action: "create" | "reuse" | "drift"
}

export function buildProgramShadowCalculationPlan(input: {
  readonly programId: string
  readonly scoringVersion: ProgramQualityScoringVersion
  readonly evidence: readonly ProgramEvidenceSourceCandidate[]
  readonly observations: readonly ProgramFactObservationCandidate[]
  readonly existingSnapshot?: ProgramQualityScore | null
  readonly existingDimensionScores?: readonly ProgramQualityDimensionScore[]
}): ProgramShadowCalculationPlan {
  const programId = requiredToken(input.programId, "programId")
  assertProgramIdentity(programId, input.evidence, input.observations)

  const evidenceIds = sortedUniqueIds(input.evidence.map((candidate) => candidate.id))
  const observationIds = sortedUniqueIds(input.observations.map((candidate) => candidate.id))
  const scoringEligibleFacts = input.observations
    .filter(isScoringEligibleObservation)
    .map((observation) => ({
      id: observation.id,
      evidenceSourceId: observation.evidenceSourceId,
      dimensionKey: observation.dimensionKey,
      factKey: observation.factKey,
      normalizedNumericValue: observation.normalizedNumericValue ?? null,
    }))
    .sort((left, right) => compareCodeUnits(left.id, right.id))
  const dimensionInputs = aggregateDimensionSignals(input.observations)

  if (scoringEligibleFacts.length > 0 || dimensionInputs.length > 0) {
    throw new TypeError("Calculated shadow plans are not enabled for the Phase 1B legacy pilot.")
  }

  const inputHash = qualityInputHash({
    programId,
    scoringVersion: {
      id: input.scoringVersion.id,
      versionKey: input.scoringVersion.versionKey,
    },
    evidenceIds,
    observationIds,
    scoringEligibleFacts,
    dimensionInputs,
    calculationPolicyVersion: PROGRAM_QUALITY_SHADOW_POLICY_VERSION,
  })
  const expectedSnapshot = createNullShadowSnapshotCandidate({
    programId,
    scoringVersionId: input.scoringVersion.id,
    inputHash,
  })
  const expectedDimensionScores: readonly ProgramQualityDimensionScoreCandidate[] = []
  const action = determineSnapshotAction({
    expectedSnapshot,
    existingSnapshot: input.existingSnapshot ?? null,
    existingDimensionScoreCount: input.existingDimensionScores?.length ?? 0,
  })

  return {
    programId,
    scoringVersionId: input.scoringVersion.id,
    inputHash,
    snapshotId: expectedSnapshot.id,
    evidenceIds,
    observationIds,
    scoringEligibleFactCount: scoringEligibleFacts.length,
    dimensionInputs,
    evidenceConfidence: 0,
    dimensionCoverageCount: 0,
    independentSourceCount: 0,
    overallQualityScore: null,
    publicEligible: false,
    publicStatusLabel: "운영 정보 확인 중",
    calculationReason: "no_scoring_eligible_evidence",
    expectedSnapshot,
    expectedDimensionScores,
    action,
  }
}

function determineSnapshotAction(input: {
  readonly expectedSnapshot: ProgramQualityScoreCandidate
  readonly existingSnapshot: ProgramQualityScore | null
  readonly existingDimensionScoreCount: number
}): ProgramShadowCalculationPlan["action"] {
  if (input.existingDimensionScoreCount > 0) return "drift"
  if (input.existingSnapshot === null || input.existingSnapshot.id !== input.expectedSnapshot.id) return "create"
  const existing = normalizeQualitySnapshotImmutablePayload(input.existingSnapshot)
  const expected = normalizeQualitySnapshotImmutablePayload(input.expectedSnapshot)
  return immutablePayloadsEqual(existing, expected) ? "reuse" : "drift"
}

function assertProgramIdentity(
  programId: string,
  evidence: readonly ProgramEvidenceSourceCandidate[],
  observations: readonly ProgramFactObservationCandidate[],
): void {
  if (evidence.some((candidate) => candidate.programId !== programId)) {
    throw new TypeError("Evidence candidate program does not match the shadow plan program.")
  }
  if (observations.some((candidate) => candidate.programId !== programId)) {
    throw new TypeError("Observation candidate program does not match the shadow plan program.")
  }
}

function sortedUniqueIds(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => requiredToken(value, "candidate id")))].sort(compareCodeUnits)
}

function requiredToken(value: string, fieldName: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new TypeError(`${fieldName} must not be empty.`)
  return trimmed
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
