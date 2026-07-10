import { z } from "zod"
import {
  criticalRiskSeverities,
  criticalRiskStatuses,
  evidenceConfidenceLabels,
  evidenceSourceTypes,
  evidenceVerificationStatuses,
  factExtractionMethods,
  factObservationStatuses,
  programQualityCalculationStatuses,
  programQualityDimensionKeys,
  programQualityScoringStatuses,
  providerClaimStatuses,
} from "@/types/campfitProgramQuality"

const JsonRecordSchema = z.record(z.string(), z.unknown())
const ScoreSchema = z.number().min(0).max(100)
const IsoDateSchema = z.string().datetime()
const DimensionWeightsSchema = z.object({
  care_emotional_support: z.number().min(0),
  staff_management: z.number().min(0),
  safety_emergency: z.number().min(0),
  parent_communication: z.number().min(0),
  english_environment: z.number().min(0),
  beginner_support: z.number().min(0),
  teaching_quality: z.number().min(0),
  living_support: z.number().min(0),
  cost_transparency: z.number().min(0),
  advertising_consistency: z.number().min(0),
}).strict()
const SourceAuthorityWeightsSchema = z.object({
  provider_claim: z.number().min(0).max(1),
  provider_official_document: z.number().min(0).max(1),
  partner_verified_document: z.number().min(0).max(1),
  public_official_page: z.number().min(0).max(1),
  independent_review: z.number().min(0).max(1),
  verified_parent_review: z.number().min(0).max(1),
  campfit_post_program_survey: z.number().min(0).max(1),
  consultation_feedback: z.number().min(0).max(1),
  official_incident_record: z.number().min(0).max(1),
  manual_audit: z.number().min(0).max(1),
  legacy_program_verification: z.number().min(0).max(1),
}).strict()

export const ProgramQualityDimensionKeySchema = z.enum(programQualityDimensionKeys)
export const EvidenceSourceTypeSchema = z.enum(evidenceSourceTypes)
export const EvidenceVerificationStatusSchema = z.enum(evidenceVerificationStatuses)
export const ProviderClaimStatusSchema = z.enum(providerClaimStatuses)
export const FactObservationStatusSchema = z.enum(factObservationStatuses)
export const CriticalRiskSeveritySchema = z.enum(criticalRiskSeverities)
export const CriticalRiskStatusSchema = z.enum(criticalRiskStatuses)
export const EvidenceConfidenceLabelSchema = z.enum(evidenceConfidenceLabels)

export const ProgramProviderClaimSchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  providerPartnerId: z.string().uuid().optional(),
  submittedByUserId: z.string().uuid().optional(),
  claimKey: z.string().min(1),
  claimValue: z.unknown(),
  unit: z.string().min(1).optional(),
  claimStatus: ProviderClaimStatusSchema,
  validFrom: IsoDateSchema.optional(),
  validUntil: IsoDateSchema.optional(),
  submittedAt: IsoDateSchema,
  reviewedAt: IsoDateSchema.optional(),
  reviewedByUserId: z.string().uuid().optional(),
  reviewNote: z.string().min(1).optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
}).strict()

export const ProgramEvidenceSourceSchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  sourceType: EvidenceSourceTypeSchema,
  sourceUrl: z.string().url().optional(),
  storagePath: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  sourceDate: IsoDateSchema.optional(),
  collectedAt: IsoDateSchema,
  validUntil: IsoDateSchema.optional(),
  verificationStatus: EvidenceVerificationStatusSchema,
  verifiedParticipation: z.boolean(),
  isIndependent: z.boolean(),
  canonicalUrl: z.string().url().optional(),
  contentHash: z.string().min(1).optional(),
  metadata: JsonRecordSchema,
  createdByUserId: z.string().uuid().optional(),
  createdAt: IsoDateSchema.optional(),
  updatedAt: IsoDateSchema.optional(),
}).strict()

export const ProgramFactObservationSchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  evidenceSourceId: z.string().uuid(),
  providerClaimId: z.string().uuid().optional(),
  dimensionKey: ProgramQualityDimensionKeySchema,
  factKey: z.string().min(1),
  factValue: z.unknown(),
  normalizedNumericValue: ScoreSchema.optional(),
  unit: z.string().min(1).optional(),
  observationStatus: FactObservationStatusSchema,
  observationConfidence: z.number().min(0).max(1),
  observedAt: IsoDateSchema.optional(),
  validUntil: IsoDateSchema.optional(),
  extractionMethod: z.enum(factExtractionMethods),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
}).strict()

export const ProgramCriticalRiskFlagSchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  evidenceSourceId: z.string().uuid().optional(),
  riskKey: z.string().min(1).optional(),
  severity: CriticalRiskSeveritySchema,
  status: CriticalRiskStatusSchema,
  internalSummary: z.string().min(1),
  publicSummary: z.string().min(1).optional(),
  detectedAt: IsoDateSchema,
  confirmedAt: IsoDateSchema.optional(),
  resolvedAt: IsoDateSchema.optional(),
  reviewedByUserId: z.string().uuid().optional(),
  resolutionNote: z.string().min(1).optional(),
  metadata: JsonRecordSchema,
}).strict()

export const ProgramQualityPublicSummarySchema = z.object({
  qualityScore: ScoreSchema.optional(),
  qualityLabel: z.string().min(1).optional(),
  confidenceScore: ScoreSchema,
  confidenceLabel: EvidenceConfidenceLabelSchema,
  publicStatus: z.enum(["운영 정보 확인 중", "근거 보통 · 참고용", "근거 충분", "추천 보류 · 추가 확인 필요"]),
  verifiedDimensions: z.array(z.string().min(1)),
  dataGaps: z.array(z.string().min(1)),
  isScoreVisible: z.boolean(),
}).strict()

export const ProgramQualityScoreSchema = z.object({
  id: z.string().uuid().optional(),
  programId: z.string().uuid(),
  scoringVersionId: z.string().uuid(),
  calculationStatus: z.enum(programQualityCalculationStatuses),
  overallQualityScore: ScoreSchema.optional(),
  evidenceConfidence: ScoreSchema,
  confidenceLabel: EvidenceConfidenceLabelSchema,
  dimensionCoverageCount: z.number().int().min(0).max(programQualityDimensionKeys.length),
  independentSourceCount: z.number().int().min(0),
  criticalRiskCount: z.number().int().min(0),
  publicEligible: z.boolean(),
  publicStatusLabel: z.enum(["운영 정보 확인 중", "근거 보통 · 참고용", "근거 충분", "추천 보류 · 추가 확인 필요"]),
  dataGaps: z.array(z.string().min(1)),
  calculationSummary: JsonRecordSchema,
  calculatedAt: IsoDateSchema,
  createdAt: IsoDateSchema.optional(),
}).strict()

export const ProgramQualityScoringVersionSchema = z.object({
  id: z.string().uuid(),
  versionKey: z.string().min(1),
  description: z.string().min(1).optional(),
  status: z.enum(programQualityScoringStatuses),
  priorScore: ScoreSchema,
  confidenceWeights: z.object({
    evidenceVolume: z.number().min(0),
    sourceDiversity: z.number().min(0),
    sourceAuthority: z.number().min(0),
    recency: z.number().min(0),
    dimensionCoverage: z.number().min(0),
    agreement: z.number().min(0),
  }).strict(),
  dimensionWeights: DimensionWeightsSchema,
  sourceAuthorityWeights: SourceAuthorityWeightsSchema,
  publicVisibilityRules: z.object({
    confidenceThreshold: ScoreSchema,
    minimumDimensionCoverage: z.number().int().min(1).max(programQualityDimensionKeys.length),
    minimumIndependentSourceCount: z.number().int().min(1),
  }).strict(),
  ruleConfig: z.object({
    providerOnlyConfidenceCap: ScoreSchema,
    providerOnlyPositivePriorAdjustmentCap: ScoreSchema,
    evidenceVolumeSaturationCount: z.number().positive(),
    recencyHalfLifeDays: z.number().positive(),
  }).strict(),
  createdAt: IsoDateSchema,
  activatedAt: IsoDateSchema.optional(),
  retiredAt: IsoDateSchema.optional(),
}).strict()
