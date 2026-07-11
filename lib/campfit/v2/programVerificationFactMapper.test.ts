import { describe, expect, it } from "vitest"
import { evidenceIdForLegacyVerification } from "@/lib/campfit/v2/programQualityBackfillIdentity"
import {
  LegacyVerificationProgramMismatchError,
  mapLegacyProgramVerification,
} from "@/lib/campfit/v2/programVerificationFactMapper"
import type { LegacyProgramVerification } from "@/lib/campfit/v2/programVerificationFactMapper"

const LEGACY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PROGRAM_ID = "11111111-1111-4111-8111-111111111111"
const VERIFIED_AT = "2026-07-09T00:00:00.000Z"
const CREATED_AT = "2026-06-23T00:00:00.000Z"

const baseVerification: LegacyProgramVerification = {
  id: LEGACY_ID,
  program_id: PROGRAM_ID,
  operator_verified: "complete",
  facility_verified: "partial",
  curriculum_verified: true,
  refund_verified: false,
  safety_verified: "missing",
  accommodation_verified: null,
  risk_labels: ["sensitive-risk-label"],
  notes: [
    "공식 출처 https://user:password@Example.com:443/program/?token=secret#private",
    "담당 parent@example.com, +82-10-1234-5678",
    "관리 우수, 안전함, 추천",
  ],
  summary: "관리 우수 프로그램",
  verified_at: VERIFIED_AT,
  created_at: CREATED_AT,
}

describe("legacy program verification mapper", () => {
  it("Given a legacy row When mapping evidence Then identity and safety defaults are fixed", () => {
    const result = mapLegacyProgramVerification({
      verification: baseVerification,
      program: { id: PROGRAM_ID },
      backfillRunId: "run-001",
    })

    expect(result.evidence).toMatchObject({
      id: evidenceIdForLegacyVerification(LEGACY_ID),
      programId: PROGRAM_ID,
      sourceType: "legacy_program_verification",
      sourceUrl: "https://example.com/program",
      verificationStatus: "unverified",
      verifiedParticipation: false,
      isIndependent: false,
      sourceDate: VERIFIED_AT,
    })
    expect(Object.keys(result.evidence.metadata).sort()).toEqual([
      "backfillVersion",
      "firstBackfillRunId",
      "legacyStatus",
      "legacyVerificationId",
      "manualReviewCandidate",
      "mapperVersion",
      "riskLabelCount",
      "sourceSystem",
    ])
    expect(result.evidence.metadata).toMatchObject({
      legacyVerificationId: LEGACY_ID,
      sourceSystem: "program_verifications",
      backfillVersion: "quality-phase1b-v1",
      mapperVersion: "legacy-mapper-v1",
      firstBackfillRunId: "run-001",
      riskLabelCount: 1,
      manualReviewCandidate: true,
    })
  })

  it("Given six legacy completeness fields When mapping Then six non-scoring observations are preserved", () => {
    const result = mapLegacyProgramVerification({
      verification: baseVerification,
      program: { id: PROGRAM_ID },
      backfillRunId: "run-001",
    })

    expect(result.metadataObservations.map((observation) => observation.factKey)).toEqual([
      "legacy_completeness.operator_verified",
      "legacy_completeness.facility_verified",
      "legacy_completeness.curriculum_verified",
      "legacy_completeness.refund_verified",
      "legacy_completeness.safety_verified",
      "legacy_completeness.accommodation_verified",
    ])
    expect(result.metadataObservations).toHaveLength(6)
    expect(result.metadataObservations.every((observation) => observation.factValue.scoringEligible === false)).toBe(true)
    expect(result.metadataObservations.every((observation) => observation.normalizedNumericValue === null)).toBe(true)
    expect(result.metadataObservations.every((observation) => observation.observationConfidence === 0)).toBe(true)
    expect(result.metadataObservations.every((observation) => observation.providerClaimId === null)).toBe(true)
    expect(result.metadataObservations.every((observation) => observation.observationStatus === "extracted")).toBe(true)
    expect(result.metadataObservations.every((observation) => observation.extractionMethod === "imported")).toBe(true)
    expect(result.metadataObservations.every((observation) => observation.observedAt === VERIFIED_AT)).toBe(true)
    expect(result.metadataObservations.map((observation) => observation.factValue.value)).toContain(true)
    expect(result.metadataObservations.map((observation) => observation.factValue.value)).toContain(false)
    expect(result.scoringFacts).toEqual([])
  })

  it("Given complete, partial, missing, boolean, and null values When mapping Then none become scores", () => {
    const result = mapLegacyProgramVerification({
      verification: { ...baseVerification, verified_at: null, risk_labels: [], notes: [] },
      program: { id: PROGRAM_ID },
      backfillRunId: "run-001",
    })
    const accommodation = result.metadataObservations.find((observation) => observation.factKey.endsWith("accommodation_verified"))

    expect(accommodation?.factValue.value).toBeNull()
    expect(result.metadataObservations.every((observation) => observation.observedAt === null)).toBe(true)
    expect(result.metadataObservations.every((observation) => observation.normalizedNumericValue === null)).toBe(true)
    expect(result.scoringFacts).toEqual([])
  })

  it("Given narrative notes and risk labels When mapping Then raw text and PII are not copied", () => {
    const result = mapLegacyProgramVerification({
      verification: baseVerification,
      program: { id: PROGRAM_ID },
      backfillRunId: "run-001",
    })
    const serialized = JSON.stringify(result)

    expect(result.evidence.sourceUrl).toBe("https://example.com/program")
    expect(result.unresolved).toEqual(["legacy_risk_labels_require_manual_review"])
    expect(result.scoringFacts).toEqual([])
    for (const forbidden of ["sensitive-risk-label", "password", "secret", "parent@example.com", "+82-10-1234-5678", "관리 우수", "안전함", "추천"]) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it("Given a program mismatch When mapping Then the mapper fails closed", () => {
    expect(() => mapLegacyProgramVerification({
      verification: baseVerification,
      program: { id: "22222222-2222-4222-8222-222222222222" },
      backfillRunId: "run-001",
    })).toThrow(LegacyVerificationProgramMismatchError)
  })
})
