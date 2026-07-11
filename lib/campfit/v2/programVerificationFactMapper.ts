import {
  evidenceIdForLegacyVerification,
  metadataObservationId,
} from "@/lib/campfit/v2/programQualityBackfillIdentity"
import { extractAndSanitizeUrls } from "@/lib/campfit/v2/programVerificationUrlSanitizer"
import type { ProgramQualityDimensionKey } from "@/types/campfitProgramQuality"

export const LEGACY_VERIFICATION_BACKFILL_VERSION = "quality-phase1b-v1" as const
export const LEGACY_VERIFICATION_MAPPER_VERSION = "legacy-mapper-v1" as const

export type LegacyVerificationValue = "complete" | "partial" | "missing" | boolean | null

export interface LegacyProgramVerification {
  readonly id: string
  readonly program_id: string
  readonly operator_verified: LegacyVerificationValue
  readonly facility_verified: LegacyVerificationValue
  readonly curriculum_verified: LegacyVerificationValue
  readonly refund_verified: LegacyVerificationValue
  readonly safety_verified: LegacyVerificationValue
  readonly accommodation_verified: LegacyVerificationValue
  readonly risk_labels: readonly string[] | null
  readonly notes: readonly string[] | null
  readonly summary?: string | null
  readonly verified_at: string | null
  readonly created_at: string
}

export type LegacyVerificationFieldName =
  | "operator_verified"
  | "facility_verified"
  | "curriculum_verified"
  | "refund_verified"
  | "safety_verified"
  | "accommodation_verified"

export type LegacyVerificationStatusMap = {
  readonly [Field in LegacyVerificationFieldName]: LegacyVerificationValue
}

export interface LegacyEvidenceMetadata {
  readonly legacyVerificationId: string
  readonly legacyStatus: LegacyVerificationStatusMap
  readonly sourceSystem: "program_verifications"
  readonly backfillVersion: typeof LEGACY_VERIFICATION_BACKFILL_VERSION
  readonly mapperVersion: typeof LEGACY_VERIFICATION_MAPPER_VERSION
  readonly firstBackfillRunId: string
  readonly riskLabelCount: number
  readonly manualReviewCandidate: boolean
}

export interface LegacyEvidenceSourceCandidate {
  readonly id: string
  readonly programId: string
  readonly sourceType: "legacy_program_verification"
  readonly sourceUrl: string | null
  readonly title: string
  readonly sourceDate: string | null
  readonly verificationStatus: "unverified"
  readonly verifiedParticipation: false
  readonly isIndependent: false
  readonly metadata: LegacyEvidenceMetadata
}

export interface LegacyMetadataFactValue {
  readonly value: LegacyVerificationValue
  readonly scoringEligible: false
  readonly source: "legacy_completeness"
}

export interface LegacyMetadataObservationCandidate {
  readonly id: string
  readonly programId: string
  readonly evidenceSourceId: string
  readonly providerClaimId: null
  readonly dimensionKey: ProgramQualityDimensionKey
  readonly factKey: `legacy_completeness.${LegacyVerificationFieldName}`
  readonly factValue: LegacyMetadataFactValue
  readonly normalizedNumericValue: null
  readonly unit: null
  readonly observationStatus: "extracted"
  readonly observationConfidence: 0
  readonly observedAt: string | null
  readonly validUntil: null
  readonly extractionMethod: "imported"
}

export interface LegacyVerificationMappingResult {
  readonly evidence: LegacyEvidenceSourceCandidate
  readonly metadataObservations: readonly LegacyMetadataObservationCandidate[]
  readonly scoringFacts: []
  readonly unresolved: readonly string[]
  readonly warnings: readonly string[]
}

type LegacyVerificationMappingInput = {
  readonly verification: LegacyProgramVerification
  readonly program: { readonly id: string }
  readonly backfillRunId: string
}

const LEGACY_VERIFICATION_FIELD_RULES = [
  { field: "operator_verified", dimensionKey: "staff_management" },
  { field: "facility_verified", dimensionKey: "living_support" },
  { field: "curriculum_verified", dimensionKey: "teaching_quality" },
  { field: "refund_verified", dimensionKey: "cost_transparency" },
  { field: "safety_verified", dimensionKey: "safety_emergency" },
  { field: "accommodation_verified", dimensionKey: "living_support" },
] as const satisfies readonly {
  readonly field: LegacyVerificationFieldName
  readonly dimensionKey: ProgramQualityDimensionKey
}[]

export class LegacyVerificationProgramMismatchError extends Error {
  readonly verificationProgramId: string
  readonly requestedProgramId: string

  constructor(verificationProgramId: string, requestedProgramId: string) {
    super("Legacy verification program does not match the requested program.")
    this.name = "LegacyVerificationProgramMismatchError"
    this.verificationProgramId = verificationProgramId
    this.requestedProgramId = requestedProgramId
  }
}

export function mapLegacyProgramVerification(input: LegacyVerificationMappingInput): LegacyVerificationMappingResult {
  const { verification, program } = input
  if (verification.program_id !== program.id) {
    throw new LegacyVerificationProgramMismatchError(verification.program_id, program.id)
  }
  const firstBackfillRunId = input.backfillRunId.trim()
  if (firstBackfillRunId.length === 0) throw new TypeError("backfillRunId must not be empty.")

  const evidenceId = evidenceIdForLegacyVerification(verification.id)
  const legacyStatus = legacyStatusFor(verification)
  const riskLabelCount = verification.risk_labels?.filter((label) => label.trim().length > 0).length ?? 0
  const sanitizedUrls = extractAndSanitizeUrls(verification.notes?.join("\n") ?? "")
  const scoringFacts: [] = []

  return {
    evidence: {
      id: evidenceId,
      programId: verification.program_id,
      sourceType: "legacy_program_verification",
      sourceUrl: sanitizedUrls[0] ?? null,
      title: "Legacy program verification record",
      sourceDate: verification.verified_at,
      verificationStatus: "unverified",
      verifiedParticipation: false,
      isIndependent: false,
      metadata: {
        legacyVerificationId: verification.id,
        legacyStatus,
        sourceSystem: "program_verifications",
        backfillVersion: LEGACY_VERIFICATION_BACKFILL_VERSION,
        mapperVersion: LEGACY_VERIFICATION_MAPPER_VERSION,
        firstBackfillRunId,
        riskLabelCount,
        manualReviewCandidate: riskLabelCount > 0,
      },
    },
    metadataObservations: LEGACY_VERIFICATION_FIELD_RULES.map(({ field, dimensionKey }) => ({
      id: metadataObservationId(verification.id, `legacy_completeness.${field}`),
      programId: verification.program_id,
      evidenceSourceId: evidenceId,
      providerClaimId: null,
      dimensionKey,
      factKey: `legacy_completeness.${field}`,
      factValue: {
        value: verification[field],
        scoringEligible: false,
        source: "legacy_completeness",
      },
      normalizedNumericValue: null,
      unit: null,
      observationStatus: "extracted",
      observationConfidence: 0,
      observedAt: verification.verified_at,
      validUntil: null,
      extractionMethod: "imported",
    })),
    scoringFacts,
    unresolved: riskLabelCount > 0 ? ["legacy_risk_labels_require_manual_review"] : [],
    warnings: [],
  }
}

function legacyStatusFor(verification: LegacyProgramVerification): LegacyVerificationStatusMap {
  return {
    operator_verified: verification.operator_verified,
    facility_verified: verification.facility_verified,
    curriculum_verified: verification.curriculum_verified,
    refund_verified: verification.refund_verified,
    safety_verified: verification.safety_verified,
    accommodation_verified: verification.accommodation_verified,
  }
}
