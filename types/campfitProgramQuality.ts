export const programQualityDimensionKeys = [
  "care_emotional_support",
  "staff_management",
  "safety_emergency",
  "parent_communication",
  "english_environment",
  "beginner_support",
  "teaching_quality",
  "living_support",
  "cost_transparency",
  "advertising_consistency",
] as const
export type ProgramQualityDimensionKey = (typeof programQualityDimensionKeys)[number]
export const evidenceSourceTypes = [
  "provider_claim",
  "provider_official_document",
  "partner_verified_document",
  "public_official_page",
  "independent_review",
  "verified_parent_review",
  "campfit_post_program_survey",
  "consultation_feedback",
  "official_incident_record",
  "manual_audit",
  "legacy_program_verification",
] as const
export type EvidenceSourceType = (typeof evidenceSourceTypes)[number]
export const evidenceVerificationStatuses = ["unverified", "verified", "rejected", "expired"] as const
export type EvidenceVerificationStatus = (typeof evidenceVerificationStatuses)[number]
export const providerClaimStatuses = ["submitted", "under_review", "verified", "rejected", "expired"] as const
export type ProviderClaimStatus = (typeof providerClaimStatuses)[number]
export const factObservationStatuses = ["extracted", "verified", "disputed", "rejected", "expired"] as const
export type FactObservationStatus = (typeof factObservationStatuses)[number]

export const factExtractionMethods = ["manual", "deterministic", "ai_extracted", "imported"] as const
export type FactExtractionMethod = (typeof factExtractionMethods)[number]

export const criticalRiskSeverities = ["medium", "high", "critical"] as const
export type CriticalRiskSeverity = (typeof criticalRiskSeverities)[number]

export const criticalRiskStatuses = ["under_review", "confirmed", "resolved", "dismissed"] as const
export type CriticalRiskStatus = (typeof criticalRiskStatuses)[number]

export const evidenceConfidenceLabels = ["very_low", "low", "medium", "high", "very_high"] as const
export type EvidenceConfidenceLabel = (typeof evidenceConfidenceLabels)[number]

export const programQualityScoringStatuses = ["draft", "shadow", "active", "retired"] as const
export type ProgramQualityScoringStatus = (typeof programQualityScoringStatuses)[number]

export const programQualityCalculationStatuses = ["shadow", "published", "superseded", "failed"] as const
export type ProgramQualityCalculationStatus = (typeof programQualityCalculationStatuses)[number]

export type ProgramQualityConfidenceWeights = {
  readonly evidenceVolume: number
  readonly sourceDiversity: number
  readonly sourceAuthority: number
  readonly recency: number
  readonly dimensionCoverage: number
  readonly agreement: number
}

export type ProgramQualityPublicVisibilityRules = {
  readonly confidenceThreshold: number
  readonly minimumDimensionCoverage: number
  readonly minimumIndependentSourceCount: number
}

export type ProgramQualityRuleConfig = {
  readonly providerOnlyConfidenceCap: number
  readonly providerOnlyPositivePriorAdjustmentCap: number
  readonly evidenceVolumeSaturationCount: number
  readonly recencyHalfLifeDays: number
}

export type ProgramQualityScoringVersion = {
  readonly id: string
  readonly versionKey: string
  readonly description?: string
  readonly status: ProgramQualityScoringStatus
  readonly priorScore: number
  readonly confidenceWeights: ProgramQualityConfidenceWeights
  readonly dimensionWeights: Readonly<Record<ProgramQualityDimensionKey, number>>
  readonly sourceAuthorityWeights: Readonly<Record<EvidenceSourceType, number>>
  readonly publicVisibilityRules: ProgramQualityPublicVisibilityRules
  readonly ruleConfig: ProgramQualityRuleConfig
  readonly createdAt: string
  readonly activatedAt?: string
  readonly retiredAt?: string
}

export type ProgramProviderClaim = {
  readonly id: string
  readonly programId: string
  readonly providerPartnerId?: string
  readonly submittedByUserId?: string
  readonly claimKey: string
  readonly claimValue: unknown
  readonly unit?: string
  readonly claimStatus: ProviderClaimStatus
  readonly validFrom?: string
  readonly validUntil?: string
  readonly submittedAt: string
  readonly reviewedAt?: string
  readonly reviewedByUserId?: string
  readonly reviewNote?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export type ProgramEvidenceSource = {
  readonly id: string
  readonly programId: string
  readonly sourceType: EvidenceSourceType
  readonly sourceUrl?: string
  readonly storagePath?: string
  readonly title?: string
  readonly sourceDate?: string
  readonly collectedAt: string
  readonly validUntil?: string
  readonly verificationStatus: EvidenceVerificationStatus
  readonly verifiedParticipation: boolean
  readonly isIndependent: boolean
  readonly canonicalUrl?: string
  readonly contentHash?: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdByUserId?: string
  readonly createdAt?: string
  readonly updatedAt?: string
}

export type ProgramFactObservation = {
  readonly id: string
  readonly programId: string
  readonly evidenceSourceId: string
  readonly providerClaimId?: string
  readonly dimensionKey: ProgramQualityDimensionKey
  readonly factKey: string
  readonly factValue: unknown
  readonly normalizedNumericValue?: number
  readonly unit?: string
  readonly observationStatus: FactObservationStatus
  readonly observationConfidence: number
  readonly observedAt?: string
  readonly validUntil?: string
  readonly extractionMethod: FactExtractionMethod
  readonly createdAt: string
  readonly updatedAt: string
}

export type ProgramQualityDimensionInput = {
  readonly dimensionKey: ProgramQualityDimensionKey
  readonly priorScore?: number
  readonly observedScore?: number
  readonly dataGaps?: readonly string[]
  readonly explanation?: Readonly<Record<string, unknown>>
}

export type ProgramQualityDimensionScore = {
  readonly dimensionKey: ProgramQualityDimensionKey
  readonly priorScore: number
  readonly observedScore?: number
  readonly adjustedScore?: number
  readonly dimensionConfidence: number
  readonly evidenceCount: number
  readonly independentSourceCount: number
  readonly dataGaps: readonly string[]
  readonly explanation: Readonly<Record<string, unknown>>
}

export type ProgramCriticalRiskFlag = {
  readonly id: string
  readonly programId: string
  readonly evidenceSourceId?: string
  readonly riskKey?: string
  readonly severity: CriticalRiskSeverity
  readonly status: CriticalRiskStatus
  readonly internalSummary: string
  readonly publicSummary?: string
  readonly detectedAt: string
  readonly confirmedAt?: string
  readonly resolvedAt?: string
  readonly reviewedByUserId?: string
  readonly resolutionNote?: string
  readonly metadata: Readonly<Record<string, unknown>>
}

export type ProgramQualityPublicEligibility = {
  readonly isEligible: boolean
  readonly isScoreVisible: boolean
  readonly statusLabel: "운영 정보 확인 중" | "근거 보통 · 참고용" | "근거 충분" | "추천 보류 · 추가 확인 필요"
}

export type ProgramQualityScore = {
  readonly id?: string
  readonly programId: string
  readonly scoringVersionId: string
  readonly calculationStatus: ProgramQualityCalculationStatus
  readonly overallQualityScore?: number
  readonly evidenceConfidence: number
  readonly confidenceLabel: EvidenceConfidenceLabel
  readonly dimensionCoverageCount: number
  readonly independentSourceCount: number
  readonly criticalRiskCount: number
  readonly publicEligible: boolean
  readonly publicStatusLabel: ProgramQualityPublicEligibility["statusLabel"]
  readonly dataGaps: readonly string[]
  readonly calculationSummary: Readonly<Record<string, unknown>>
  readonly calculatedAt: string
  readonly createdAt?: string
}

export type ProgramQualityPublicSummary = {
  readonly qualityScore?: number
  readonly qualityLabel?: string
  readonly confidenceScore: number
  readonly confidenceLabel: EvidenceConfidenceLabel
  readonly publicStatus: ProgramQualityPublicEligibility["statusLabel"]
  readonly verifiedDimensions: readonly string[]
  readonly dataGaps: readonly string[]
  readonly isScoreVisible: boolean
}

export type ProgramEvidenceConfidenceResult = {
  readonly score: number
  readonly label: EvidenceConfidenceLabel
  readonly effectiveSourceCount: number
  readonly independentSourceCount: number
  readonly dimensionCoverage: number
  readonly providerOnly: boolean
}

export type ProgramQualityCalculationInput = {
  readonly programId: string
  readonly scoringVersion: ProgramQualityScoringVersion
  readonly evidenceSources: readonly ProgramEvidenceSource[]
  readonly dimensions: readonly ProgramQualityDimensionInput[]
  readonly criticalRisks: readonly ProgramCriticalRiskFlag[]
  readonly agreementScore: number
  readonly calculatedAt: string
}

export type ProgramQualityCalculationResult = {
  readonly qualityScore: ProgramQualityScore
  readonly dimensionScores: readonly ProgramQualityDimensionScore[]
  readonly publicEligibility: ProgramQualityPublicEligibility
  readonly activeHighOrCriticalRiskCount: number
  readonly overallQualityScore?: number
  readonly evidenceConfidence: number
  readonly dimensionCoverageCount: number
}
