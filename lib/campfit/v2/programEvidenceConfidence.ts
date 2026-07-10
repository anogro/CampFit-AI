import type {
  EvidenceConfidenceLabel,
  ProgramEvidenceConfidenceResult,
  ProgramEvidenceSource,
  ProgramQualityScoringVersion,
  ProgramQualityDimensionKey,
} from "@/types/campfitProgramQuality"

type EvidenceConfidenceInput = {
  readonly sources: readonly ProgramEvidenceSource[]
  readonly coveredDimensions: readonly ProgramQualityDimensionKey[]
  readonly agreementScore: number
  readonly now: string
  readonly scoringVersion: ProgramQualityScoringVersion
}

export function calculateEvidenceConfidence(input: EvidenceConfidenceInput): ProgramEvidenceConfidenceResult {
  const sources = uniqueSources(input.sources)
  if (sources.length === 0) {
    return {
      score: 0,
      label: "very_low",
      effectiveSourceCount: 0,
      independentSourceCount: 0,
      dimensionCoverage: calculateDimensionCoverage(input.coveredDimensions),
      providerOnly: false,
    }
  }

  const independentSourceCount = determineIndependentSourceCount(sources)
  const providerOnly = independentSourceCount === 0
  const weights = input.scoringVersion.confidenceWeights
  const rawScore = (
    volumeScore(sources.length, input.scoringVersion.ruleConfig.evidenceVolumeSaturationCount) * weights.evidenceVolume +
    diversityScore(sources, independentSourceCount) * weights.sourceDiversity +
    authorityScore(sources, input.scoringVersion) * weights.sourceAuthority +
    recencyScore(sources, input.now, input.scoringVersion.ruleConfig.recencyHalfLifeDays) * weights.recency +
    calculateDimensionCoverage(input.coveredDimensions) * weights.dimensionCoverage +
    clampScore(input.agreementScore) * weights.agreement
  ) / totalWeight(weights)
  const cappedScore = providerOnly
    ? Math.min(rawScore, input.scoringVersion.ruleConfig.providerOnlyConfidenceCap)
    : rawScore
  const score = clampScore(cappedScore)

  return {
    score,
    label: confidenceLabelForScore(score),
    effectiveSourceCount: sources.length,
    independentSourceCount,
    dimensionCoverage: calculateDimensionCoverage(input.coveredDimensions),
    providerOnly,
  }
}

export function confidenceLabelForScore(score: number): EvidenceConfidenceLabel {
  const normalized = clampScore(score)
  if (normalized <= 24) return "very_low"
  if (normalized <= 49) return "low"
  if (normalized <= 69) return "medium"
  if (normalized <= 84) return "high"
  return "very_high"
}

export function calculateDimensionCoverage(dimensions: readonly ProgramQualityDimensionKey[]): number {
  return clampScore((new Set(dimensions).size / 10) * 100)
}

export function determineIndependentSourceCount(sources: readonly ProgramEvidenceSource[]): number {
  return sources.filter((source) => source.isIndependent).length
}

function uniqueSources(sources: readonly ProgramEvidenceSource[]): readonly ProgramEvidenceSource[] {
  const canonicalUrls = new Set<string>()
  const contentHashes = new Set<string>()
  const sourceIds = new Set<string>()
  const unique: ProgramEvidenceSource[] = []

  for (const source of sources) {
    const hasDuplicateUrl = source.canonicalUrl !== undefined && canonicalUrls.has(source.canonicalUrl)
    const hasDuplicateHash = source.contentHash !== undefined && contentHashes.has(source.contentHash)
    const hasDuplicateId = source.canonicalUrl === undefined && source.contentHash === undefined && sourceIds.has(source.id)
    if (hasDuplicateUrl || hasDuplicateHash || hasDuplicateId) {
      continue
    }

    if (source.canonicalUrl !== undefined) canonicalUrls.add(source.canonicalUrl)
    if (source.contentHash !== undefined) contentHashes.add(source.contentHash)
    sourceIds.add(source.id)
    unique.push(source)
  }

  return unique
}

function volumeScore(count: number, saturationCount: number): number {
  return 100 * (1 - Math.exp(-count / saturationCount))
}

function diversityScore(sources: readonly ProgramEvidenceSource[], independentSourceCount: number): number {
  const sourceTypeScore = Math.min(1, new Set(sources.map((source) => source.sourceType)).size / 4)
  const independenceScore = Math.min(1, independentSourceCount / 2)
  return ((sourceTypeScore + independenceScore) / 2) * 100
}

function authorityScore(sources: readonly ProgramEvidenceSource[], scoringVersion: ProgramQualityScoringVersion): number {
  const sourceTypes = new Set(sources.map((source) => source.sourceType))
  const weights = [...sourceTypes].map((sourceType) => scoringVersion.sourceAuthorityWeights[sourceType])
  return (weights.reduce((sum, weight) => sum + weight, 0) / weights.length) * 100
}

function recencyScore(sources: readonly ProgramEvidenceSource[], now: string, halfLifeDays: number): number {
  const nowTime = Date.parse(now)
  const values = sources.map((source) => {
    const sourceTime = Date.parse(source.sourceDate ?? source.collectedAt)
    if (!Number.isFinite(nowTime) || !Number.isFinite(sourceTime)) return 0
    const ageDays = Math.max(0, (nowTime - sourceTime) / 86_400_000)
    return Math.exp((-Math.LN2 * ageDays) / halfLifeDays) * 100
  })
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function totalWeight(weights: ProgramQualityScoringVersion["confidenceWeights"]): number {
  return weights.evidenceVolume + weights.sourceDiversity + weights.sourceAuthority + weights.recency + weights.dimensionCoverage + weights.agreement
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
