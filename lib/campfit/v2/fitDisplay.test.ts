import { describe, expect, it } from "vitest"
import { buildDisplayFitAxes, buildRiskManagementNote } from "@/lib/campfit/v2/fitDisplay"
import type { FitScoreAxis } from "@/types/campfitV2"

const axes: readonly FitScoreAxis[] = [
  { key: "child_fit", label: "아이 적응 적합도", score: 88, comment: "초기 적응 지원이 있으면 안정적으로 참여할 가능성이 높습니다." },
  { key: "english_readiness", label: "영어 준비도 적합도", score: 74, comment: "활동 속 영어 노출이 더 적합합니다." },
  { key: "family_constraints", label: "부모 조건 적합도", score: 82, comment: "부모 체류 조건을 반영할 수 있습니다." },
  { key: "support_fit", label: "지원장치 적합도", score: 76, comment: "초기 적응과 생활 지원 범위를 확인하세요." },
  { key: "growth_balance", label: "성장 자극 적합도", score: 80, comment: "문화 경험과 활동의 균형을 기대할 수 있습니다." },
  { key: "budget_reality", label: "비용 현실성", score: 64, comment: "포함 비용을 확인해야 합니다." },
  { key: "risk_management", label: "리스크 관리", score: 70, comment: "초기 적응과 지원장치 확인이 중요합니다." },
]

describe("buildDisplayFitAxes", () => {
  it("Given seven report axes When preparing report display Then six parent-facing axes are returned", () => {
    const displayAxes = buildDisplayFitAxes(axes)

    expect(displayAxes).toHaveLength(6)
    expect(displayAxes.map((axis) => axis.label)).toEqual(["아이 적응", "영어 준비", "부모 조건", "지원/안전", "성장 자극", "비용 현실성"])
    expect(displayAxes[3]?.score).toBe(74)
  })

  it("Given missing or invalid scores When preparing report display Then scores fall back safely", () => {
    const displayAxes = buildDisplayFitAxes([{ key: "child_fit", label: "아이 적응 적합도", score: Number.NaN, comment: "확인 필요" }])

    expect(displayAxes[0]?.score).toBe(0)
    expect(displayAxes[5]?.score).toBe(0)
  })

  it("Given a risk management axis When preparing its note Then a parent-facing note is returned", () => {
    expect(buildRiskManagementNote(axes)).toBe("리스크 관리: 초기 적응과 지원장치 확인이 중요합니다.")
  })
})
