import { describe, expect, it } from "vitest"
import {
  PROGRAM_QUALITY_BACKFILL_UUID_NAMESPACE,
  backfillRunId,
  evidenceIdForLegacyVerification,
  metadataObservationId,
  qualityInputHash,
  shadowSnapshotId,
  stableCanonicalJson,
} from "@/lib/campfit/v2/programQualityBackfillIdentity"

const LEGACY_ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const LEGACY_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PROGRAM_ID_A = "11111111-1111-4111-8111-111111111111"
const PROGRAM_ID_B = "22222222-2222-4222-8222-222222222222"
const SCORING_VERSION_ID = "33333333-3333-4333-8333-333333333333"

describe("program quality backfill identity", () => {
  it("Given the approved namespace When generating legacy identities Then golden UUIDv5 vectors remain fixed", () => {
    expect(PROGRAM_QUALITY_BACKFILL_UUID_NAMESPACE).toBe("cbe01a67-171a-50e5-8713-25610371e2a0")
    expect(evidenceIdForLegacyVerification(LEGACY_ID_A)).toBe("ca41e4b2-8f80-5cef-92fa-f9462ae352bc")
    expect(metadataObservationId(LEGACY_ID_A, "legacy_completeness.support_verified")).toBe("7b5c6ef1-0a30-59db-b635-255e60ed8966")
    expect(shadowSnapshotId(PROGRAM_ID_A, SCORING_VERSION_ID, "abcdef123456")).toBe("234502be-72d7-5a23-8173-6e4d7c632473")
    expect(backfillRunId({
      backfillVersion: "quality-phase1b-v1",
      mapperVersion: "legacy-mapper-v1",
      programIds: [PROGRAM_ID_A, PROGRAM_ID_B],
      legacyVerificationIds: [LEGACY_ID_A, LEGACY_ID_B],
    })).toBe("44784c6d-9d55-5fa7-b773-6ea94b83520d")
  })

  it("Given identical and reordered run inputs When generating IDs Then output is deterministic and set-based", () => {
    const canonical = backfillRunId({
      backfillVersion: "quality-phase1b-v1",
      mapperVersion: "legacy-mapper-v1",
      programIds: [PROGRAM_ID_A, PROGRAM_ID_B],
      legacyVerificationIds: [LEGACY_ID_A, LEGACY_ID_B],
    })
    const reordered = backfillRunId({
      backfillVersion: "quality-phase1b-v1",
      mapperVersion: "legacy-mapper-v1",
      programIds: [PROGRAM_ID_B, ` ${PROGRAM_ID_A} `, PROGRAM_ID_A],
      legacyVerificationIds: [LEGACY_ID_B, ` ${LEGACY_ID_A} `, LEGACY_ID_A],
    })

    expect(reordered).toBe(canonical)
    expect(backfillRunId({
      backfillVersion: "quality-phase1b-v1",
      mapperVersion: "legacy-mapper-v1",
      programIds: [PROGRAM_ID_A, PROGRAM_ID_B],
      legacyVerificationIds: [LEGACY_ID_A, LEGACY_ID_B],
    })).toBe(canonical)
  })

  it("Given different legacy inputs When generating identities Then UUIDs remain distinct", () => {
    expect(evidenceIdForLegacyVerification(LEGACY_ID_A)).not.toBe(evidenceIdForLegacyVerification(LEGACY_ID_B))
    expect(metadataObservationId(LEGACY_ID_A, "legacy_completeness.operator_verified"))
      .not.toBe(metadataObservationId(LEGACY_ID_A, "legacy_completeness.safety_verified"))
  })

  it("Given objects with different key insertion order When canonicalizing Then JSON and hashes match", () => {
    const first = { z: 1, nested: { b: true, a: ["kept", "in-order"] } }
    const second = { nested: { a: ["kept", "in-order"], b: true }, z: 1 }

    expect(stableCanonicalJson(first)).toBe(stableCanonicalJson(second))
    expect(qualityInputHash(first)).toBe(qualityInputHash(second))
    expect(qualityInputHash({ values: [1, 2] })).not.toBe(qualityInputHash({ values: [2, 1] }))
  })

  it("Given unsupported or cyclic values When canonicalizing Then conversion fails explicitly", () => {
    const cyclic: Record<string, unknown> = {}
    cyclic["self"] = cyclic

    expect(() => stableCanonicalJson(undefined)).toThrow(TypeError)
    expect(() => stableCanonicalJson(() => undefined)).toThrow(TypeError)
    expect(() => stableCanonicalJson(Symbol("unsupported"))).toThrow(TypeError)
    expect(() => stableCanonicalJson(1n)).toThrow(TypeError)
    expect(() => stableCanonicalJson(cyclic)).toThrow(TypeError)
  })
})
