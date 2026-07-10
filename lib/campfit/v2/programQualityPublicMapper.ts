import type {
  ProgramQualityCalculationResult,
  ProgramQualityDimensionKey,
  ProgramQualityPublicSummary,
} from "@/types/campfitProgramQuality"

const dimensionLabels: Readonly<Record<ProgramQualityDimensionKey, string>> = {
  care_emotional_support: "정서 돌봄",
  staff_management: "스태프 관리",
  safety_emergency: "안전과 비상 대응",
  parent_communication: "부모 소통",
  english_environment: "영어 환경",
  beginner_support: "초급자 지원",
  teaching_quality: "수업 품질",
  living_support: "생활 지원",
  cost_transparency: "비용 투명성",
  advertising_consistency: "안내 내용 일치도",
}

export function buildProgramQualityPublicSummary(result: ProgramQualityCalculationResult): ProgramQualityPublicSummary {
  const isScoreVisible = result.publicEligibility.isScoreVisible && result.qualityScore.overallQualityScore !== undefined
  const verifiedDimensions = result.dimensionScores
    .filter((dimension) => dimension.adjustedScore !== undefined)
    .map((dimension) => dimensionLabels[dimension.dimensionKey])
  const dataGaps = [...new Set(result.qualityScore.dataGaps)]

  return {
    ...(isScoreVisible ? {
      qualityScore: result.qualityScore.overallQualityScore,
      qualityLabel: qualityLabelForScore(result.qualityScore.overallQualityScore),
    } : {}),
    confidenceScore: result.qualityScore.evidenceConfidence,
    confidenceLabel: result.qualityScore.confidenceLabel,
    publicStatus: result.publicEligibility.statusLabel,
    verifiedDimensions,
    dataGaps,
    isScoreVisible,
  }
}

function qualityLabelForScore(score: number): string {
  if (score >= 80) return "전반적으로 양호"
  if (score >= 65) return "검토 가능한 수준"
  return "상담 전 확인이 필요한 수준"
}
