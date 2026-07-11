import {
  immutablePayloadsEqual,
  normalizeDimensionScoreImmutablePayload,
  normalizeEvidenceImmutablePayload,
  normalizeObservationImmutablePayload,
  normalizeQualitySnapshotImmutablePayload,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import type {
  ProgramEvidenceSourceCandidate,
  ProgramFactObservationCandidate,
  ProgramQualityDimensionScoreCandidate,
  ProgramQualityScoreCandidate,
} from "@/lib/campfit/v2/programQualityImmutablePayload"
import type {
  ProgramEvidenceSource,
  ProgramFactObservation,
  ProgramQualityScore,
} from "@/types/campfitProgramQuality"

export type InsertOrVerifyAction = "inserted" | "reused" | "drift"

export interface InsertOrVerifyResult<T> {
  readonly action: InsertOrVerifyAction
  readonly row?: T
  readonly drift?: {
    readonly existing: unknown
    readonly expected: unknown
  }
}

export interface ImmutableRowAdapter<T> {
  readonly findById: (id: string) => Promise<T | null>
  readonly insert: (row: T) => Promise<T>
}

export async function insertOrVerifyImmutable<T>(input: {
  readonly id: string
  readonly expected: T
  readonly adapter: ImmutableRowAdapter<T>
  readonly normalize: (row: T) => unknown
}): Promise<InsertOrVerifyResult<T>> {
  const existing = await input.adapter.findById(input.id)
  if (existing === null) {
    const inserted = await input.adapter.insert(input.expected)
    return { action: "inserted", row: inserted }
  }

  const normalizedExisting = input.normalize(existing)
  const normalizedExpected = input.normalize(input.expected)
  if (immutablePayloadsEqual(normalizedExisting, normalizedExpected)) {
    return { action: "reused", row: existing }
  }

  return {
    action: "drift",
    drift: {
      existing: normalizedExisting,
      expected: normalizedExpected,
    },
  }
}

export function insertOrVerifyEvidence<T extends ProgramEvidenceSourceCandidate | ProgramEvidenceSource>(input: {
  readonly expected: T
  readonly adapter: ImmutableRowAdapter<T>
}): Promise<InsertOrVerifyResult<T>> {
  return insertOrVerifyImmutable({
    id: input.expected.id,
    expected: input.expected,
    adapter: input.adapter,
    normalize: normalizeEvidenceImmutablePayload,
  })
}

export function insertOrVerifyObservation<T extends ProgramFactObservationCandidate | ProgramFactObservation>(input: {
  readonly expected: T
  readonly adapter: ImmutableRowAdapter<T>
}): Promise<InsertOrVerifyResult<T>> {
  return insertOrVerifyImmutable({
    id: input.expected.id,
    expected: input.expected,
    adapter: input.adapter,
    normalize: normalizeObservationImmutablePayload,
  })
}

type IdentifiedProgramQualityScore = ProgramQualityScore & { readonly id: string }

export function insertOrVerifyShadowSnapshot<T extends ProgramQualityScoreCandidate | IdentifiedProgramQualityScore>(input: {
  readonly expected: T
  readonly adapter: ImmutableRowAdapter<T>
}): Promise<InsertOrVerifyResult<T>> {
  return insertOrVerifyImmutable({
    id: input.expected.id,
    expected: input.expected,
    adapter: input.adapter,
    normalize: normalizeQualitySnapshotImmutablePayload,
  })
}

export function insertOrVerifyDimensionScore<T extends ProgramQualityDimensionScoreCandidate>(input: {
  readonly expected: T
  readonly adapter: ImmutableRowAdapter<T>
}): Promise<InsertOrVerifyResult<T>> {
  return insertOrVerifyImmutable({
    id: input.expected.id,
    expected: input.expected,
    adapter: input.adapter,
    normalize: normalizeDimensionScoreImmutablePayload,
  })
}
