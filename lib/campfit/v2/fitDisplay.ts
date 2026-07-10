import type { FitScoreAxis } from "@/types/campfitV2"

export type DisplayFitAxis = {
  readonly label: string
  readonly score: number
  readonly comment: string
}

const displayAxisDefinitions = [
  { label: "아이 적응", sourceKey: "child_fit", fallbackComment: "초기 적응에 필요한 지원을 함께 확인하세요." },
  { label: "영어 준비", sourceKey: "english_readiness", fallbackComment: "활동 속 영어 노출 방식을 함께 살펴보세요." },
  { label: "부모 조건", sourceKey: "family_constraints", fallbackComment: "동행과 현지 체류 조건을 함께 확인하세요." },
  { label: "지원/안전", sourceKey: "support_fit", fallbackComment: "초기 적응과 생활 지원 범위를 확인하세요." },
  { label: "성장 자극", sourceKey: "growth_balance", fallbackComment: "문화 경험과 활동의 균형을 살펴보세요." },
  { label: "비용 현실성", sourceKey: "budget_reality", fallbackComment: "항공권을 포함한 실제 비용을 상담 전 확인하세요." },
] as const

export function buildDisplayFitAxes(axes: readonly FitScoreAxis[]): readonly DisplayFitAxis[] {
  const axesByKey = new Map(axes.map((axis) => [axis.key, axis]))
  const riskAxis = axesByKey.get("risk_management")

  return displayAxisDefinitions.map((definition) => {
    const sourceAxis = axesByKey.get(definition.sourceKey)
    const baseScore = normalizedScore(sourceAxis?.score)
    const score = definition.sourceKey === "support_fit"
      ? Math.round(((baseScore * 2) + normalizedScore(riskAxis?.score)) / 3)
      : baseScore

    return {
      label: definition.label,
      score,
      comment: sourceAxis?.comment.trim() || definition.fallbackComment,
    }
  })
}

export function buildRiskManagementNote(axes: readonly FitScoreAxis[]): string {
  const riskComment = axes.find((axis) => axis.key === "risk_management")?.comment.trim()
  return `리스크 관리: ${riskComment || "초기 적응과 지원장치 확인이 중요합니다."}`
}

function normalizedScore(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}
