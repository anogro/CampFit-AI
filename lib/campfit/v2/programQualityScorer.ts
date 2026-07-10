import {
  calculateEvidenceConfidence,
  confidenceLabelForScore,
  determineIndependentSourceCount,
} from "@/lib/campfit/v2/programEvidenceConfidence"
import type {
  ProgramQualityCalculationInput,
  ProgramQualityCalculationResult,
  ProgramQualityDimensionScore,
  ProgramQualityPublicEligibility,
  ProgramQualityScoringVersion,
} from "@/types/campfitProgramQuality"

const shadowVersionId = "00000000-0000-0000-0000-000000000001"
const shadowCreatedAt = "2026-07-11T00:00:00.000Z"

type AdjustedDimensionScoreInput = {
  readonly priorScore: number
  readonly observedScore?: number
  readonly dimensionConfidence: number
  readonly providerOnlyPositiveEvidence?: boolean
  readonly positivePriorAdjustmentCap?: number
}

type OverallQualityInput = {
  readonly dimensionScores: readonly ProgramQualityDimensionScore[]
  readonly scoringVersion: ProgramQualityScoringVersion
}

type PublicEligibilityInput = {
  readonly evidenceConfidence: number
  readonly dimensionCoverageCount: number
  readonly independentSourceCount: number
  readonly activeHighOrCriticalRiskCount: number
  readonly scoringVersion: ProgramQualityScoringVersion
}

export function createShadowProgramQualityScoringVersion(): ProgramQualityScoringVersion {
  return {
    id: shadowVersionId,
    versionKey: "campfit_quality_v1_shadow",
    description: "Phase 1A evidence-based program quality scoring in shadow mode.",
    status: "shadow",
    priorScore: 60,
    confidenceWeights: {
      evidenceVolume: 0.2,
      sourceDiversity: 0.2,
      sourceAuthority: 0.2,
      recency: 0.15,
      dimensionCoverage: 0.15,
      agreement: 0.1,
    },
    dimensionWeights: {
      care_emotional_support: 0.12,
      staff_management: 0.1,
      safety_emergency: 0.14,
      parent_communication: 0.09,
      english_environment: 0.1,
      beginner_support: 0.09,
      teaching_quality: 0.1,
      living_support: 0.1,
      cost_transparency: 0.08,
      advertising_consistency: 0.08,
    },
    sourceAuthorityWeights: {
      provider_claim: 0.2,
      provider_official_document: 0.45,
      partner_verified_document: 0.7,
      public_official_page: 0.55,
      independent_review: 0.5,
      verified_parent_review: 0.8,
      campfit_post_program_survey: 0.9,
      consultation_feedback: 0.65,
      official_incident_record: 1,
      manual_audit: 0.95,
      legacy_program_verification: 0.7,
    },
    publicVisibilityRules: {
      confidenceThreshold: 50,
      minimumDimensionCoverage: 6,
      minimumIndependentSourceCount: 1,
    },
    ruleConfig: {
      providerOnlyConfidenceCap: 30,
      providerOnlyPositivePriorAdjustmentCap: 5,
      evidenceVolumeSaturationCount: 6,
      recencyHalfLifeDays: 365,
    },
    createdAt: shadowCreatedAt,
    activatedAt: shadowCreatedAt,
  }
}

export function calculateAdjustedDimensionScore(input: AdjustedDimensionScoreInput): number | null {
  if (input.observedScore === undefined) return null

  const prior = clampScore(input.priorScore)
  const observed = clampScore(input.observedScore)
  const confidence = clampScore(input.dimensionConfidence) / 100
  const adjusted = prior + confidence * (observed - prior)
  const positiveCap = input.positivePriorAdjustmentCap ?? 5

  if (input.providerOnlyPositiveEvidence && adjusted > prior) {
    return roundScore(Math.min(adjusted, prior + positiveCap))
  }

  return roundScore(adjusted)
}

export function calculateOverallProgramQuality(input: OverallQualityInput): number | undefined {
  const scoredDimensions = input.dimensionScores.filter((dimension) => dimension.adjustedScore !== undefined)
  if (scoredDimensions.length === 0) return undefined

  const totalWeight = scoredDimensions.reduce(
    (sum, dimension) => sum + input.scoringVersion.dimensionWeights[dimension.dimensionKey],
    0,
  )
  if (totalWeight === 0) return undefined

  const weightedScore = scoredDimensions.reduce(
    (sum, dimension) => sum + (dimension.adjustedScore ?? 0) * input.scoringVersion.dimensionWeights[dimension.dimensionKey],
    0,
  )
  return roundScore(weightedScore / totalWeight)
}

export function determineProgramQualityPublicEligibility(input: PublicEligibilityInput): ProgramQualityPublicEligibility {
  if (input.activeHighOrCriticalRiskCount > 0) {
    return { isEligible: false, isScoreVisible: false, statusLabel: "추천 보류 · 추가 확인 필요" }
  }
  if (input.evidenceConfidence < input.scoringVersion.publicVisibilityRules.confidenceThreshold) {
    return { isEligible: false, isScoreVisible: false, statusLabel: "운영 정보 확인 중" }
  }
  if (input.dimensionCoverageCount < input.scoringVersion.publicVisibilityRules.minimumDimensionCoverage) {
    return { isEligible: false, isScoreVisible: false, statusLabel: "운영 정보 확인 중" }
  }
  if (input.independentSourceCount < input.scoringVersion.publicVisibilityRules.minimumIndependentSourceCount) {
    return { isEligible: false, isScoreVisible: false, statusLabel: "운영 정보 확인 중" }
  }

  return input.evidenceConfidence >= 70
    ? { isEligible: true, isScoreVisible: true, statusLabel: "근거 충분" }
    : { isEligible: true, isScoreVisible: true, statusLabel: "근거 보통 · 참고용" }
}

export function calculateProgramQuality(input: ProgramQualityCalculationInput): ProgramQualityCalculationResult {
  const coveredDimensions = input.dimensions
    .filter((dimension) => dimension.observedScore !== undefined)
    .map((dimension) => dimension.dimensionKey)
  const evidence = calculateEvidenceConfidence({
    sources: input.evidenceSources,
    coveredDimensions,
    agreementScore: input.agreementScore,
    now: input.calculatedAt,
    scoringVersion: input.scoringVersion,
  })
  const activeHighOrCriticalRiskCount = input.criticalRisks.filter(
    (risk) => (risk.status === "under_review" || risk.status === "confirmed") && (risk.severity === "high" || risk.severity === "critical"),
  ).length
  const dimensionScores = input.dimensions.map((dimension) => buildDimensionScore(dimension, evidence.score, evidence.providerOnly, input))
  const overallQualityScore = calculateOverallProgramQuality({ dimensionScores, scoringVersion: input.scoringVersion })
  const publicEligibility = determineProgramQualityPublicEligibility({
    evidenceConfidence: evidence.score,
    dimensionCoverageCount: coveredDimensions.length,
    independentSourceCount: determineIndependentSourceCount(input.evidenceSources),
    activeHighOrCriticalRiskCount,
    scoringVersion: input.scoringVersion,
  })
  const dataGaps = dimensionScores.flatMap((dimension) => dimension.dataGaps)

  return {
    qualityScore: {
      programId: input.programId,
      scoringVersionId: input.scoringVersion.id,
      calculationStatus: "shadow",
      ...(overallQualityScore === undefined ? {} : { overallQualityScore }),
      evidenceConfidence: evidence.score,
      confidenceLabel: confidenceLabelForScore(evidence.score),
      dimensionCoverageCount: coveredDimensions.length,
      independentSourceCount: evidence.independentSourceCount,
      criticalRiskCount: activeHighOrCriticalRiskCount,
      publicEligible: publicEligibility.isEligible,
      publicStatusLabel: publicEligibility.statusLabel,
      dataGaps,
      calculationSummary: {
        scoringVersion: input.scoringVersion.versionKey,
        effectiveSourceCount: evidence.effectiveSourceCount,
        providerOnlyEvidence: evidence.providerOnly,
      },
      calculatedAt: input.calculatedAt,
    },
    dimensionScores,
    publicEligibility,
    activeHighOrCriticalRiskCount,
    ...(overallQualityScore === undefined ? {} : { overallQualityScore }),
    evidenceConfidence: evidence.score,
    dimensionCoverageCount: coveredDimensions.length,
  }
}

function buildDimensionScore(
  dimension: ProgramQualityCalculationInput["dimensions"][number],
  confidence: number,
  providerOnly: boolean,
  input: ProgramQualityCalculationInput,
): ProgramQualityDimensionScore {
  const priorScore = dimension.priorScore ?? input.scoringVersion.priorScore
  const dataGaps = dimension.observedScore === undefined
    ? [...(dimension.dataGaps ?? []), "근거 기반 관찰값 없음"]
    : dimension.dataGaps ?? []
  const adjustedScore = calculateAdjustedDimensionScore({
    priorScore,
    ...(dimension.observedScore === undefined ? {} : { observedScore: dimension.observedScore }),
    dimensionConfidence: confidence,
    providerOnlyPositiveEvidence: providerOnly,
    positivePriorAdjustmentCap: input.scoringVersion.ruleConfig.providerOnlyPositivePriorAdjustmentCap,
  })

  return {
    dimensionKey: dimension.dimensionKey,
    priorScore,
    ...(dimension.observedScore === undefined ? {} : { observedScore: clampScore(dimension.observedScore) }),
    ...(adjustedScore === null ? {} : { adjustedScore }),
    dimensionConfidence: confidence,
    evidenceCount: input.evidenceSources.length,
    independentSourceCount: determineIndependentSourceCount(input.evidenceSources),
    dataGaps,
    explanation: dimension.explanation ?? {},
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function roundScore(value: number): number {
  return Math.round(clampScore(value))
}
