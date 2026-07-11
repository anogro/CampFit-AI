import { programQualityDimensionKeys } from "@/types/campfitProgramQuality"
import type {
  FactObservationStatus,
  ProgramQualityDimensionInput,
  ProgramQualityDimensionKey,
} from "@/types/campfitProgramQuality"

export const QUALITY_FACT_SIGNAL_RULES_V1 = {} as const

export interface ScoringObservationCandidate {
  readonly evidenceSourceId: string
  readonly dimensionKey: ProgramQualityDimensionKey
  readonly factKey: string
  readonly factValue: unknown
  readonly normalizedNumericValue?: number | null | undefined
  readonly observationStatus: FactObservationStatus
  readonly observationConfidence: number
}

export function isScoringEligibleObservation(observation: ScoringObservationCandidate): boolean {
  if (observation.factKey.startsWith("legacy_completeness.")) return false
  if (!Object.hasOwn(QUALITY_FACT_SIGNAL_RULES_V1, observation.factKey)) return false
  if (observation.observationStatus !== "verified") return false
  if (!hasScoringEligibleFlag(observation.factValue)) return false
  if (typeof observation.normalizedNumericValue !== "number" || !Number.isFinite(observation.normalizedNumericValue)) return false
  if (observation.observationConfidence <= 0) return false
  return true
}

export function aggregateDimensionSignals(
  observations: readonly ScoringObservationCandidate[],
): ProgramQualityDimensionInput[] {
  const inputByDimension = new Map<ProgramQualityDimensionKey, ProgramQualityDimensionInput>()
  const eligible = observations.filter(isScoringEligibleObservation).sort(compareObservations)

  for (const observation of eligible) {
    if (inputByDimension.has(observation.dimensionKey)) continue
    const observedScore = observation.normalizedNumericValue
    if (typeof observedScore !== "number" || !Number.isFinite(observedScore)) continue
    inputByDimension.set(observation.dimensionKey, {
      dimensionKey: observation.dimensionKey,
      observedScore,
      dataGaps: [],
    })
  }

  return programQualityDimensionKeys.flatMap((dimensionKey) => {
    const input = inputByDimension.get(dimensionKey)
    return input === undefined ? [] : [input]
  })
}

function hasScoringEligibleFlag(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "scoringEligible" in value && value.scoringEligible === true
}

function compareObservations(left: ScoringObservationCandidate, right: ScoringObservationCandidate): number {
  if (left.observationConfidence !== right.observationConfidence) {
    return right.observationConfidence - left.observationConfidence
  }
  const factKeyOrder = compareCodeUnits(left.factKey, right.factKey)
  return factKeyOrder === 0 ? compareCodeUnits(left.evidenceSourceId, right.evidenceSourceId) : factKeyOrder
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
